import assert from 'node:assert/strict';
import test from 'node:test';
import { createRoot } from 'solid-js';
import {
  ApiError,
  buildUrl,
  configureReactive,
  createEntityStore,
  createHttpClient,
  createInfiniteQuery,
  createMutationSignal,
  createPaginatedQuery,
  createPersistedSignal,
  createQueryClient,
  createQuerySignal,
  createSelectionStore,
  createSyncedStore,
  getReactiveRuntimeConfig,
  hashQueryKey,
  matchesPartialKey,
} from '../dist/index.js';

test('runtime configuration merges fields and returns snapshots', () => {
  globalThis.window = {};
  const getAccessToken = () => 'token';
  configureReactive({ getAccessToken });
  const first = getReactiveRuntimeConfig();
  configureReactive({ queryClientOptions: { defaultOptions: { queries: { staleTime: 10 } } } });
  const second = getReactiveRuntimeConfig();

  assert.notStrictEqual(first, second);
  assert.strictEqual(first.getAccessToken, getAccessToken);
  assert.equal(first.queryClientOptions, undefined);
  assert.equal(second.queryClientOptions.defaultOptions.queries.staleTime, 10);
});

test('query keys are canonical, collision resistant, and prefix matched', () => {
  assert.equal(hashQueryKey([{ b: 2, a: 1 }]), hashQueryKey([{ a: 1, b: 2 }]));
  assert.notEqual(hashQueryKey([undefined]), hashQueryKey(['undefined']));
  assert.notEqual(hashQueryKey([-0]), hashQueryKey([0]));
  assert.equal(matchesPartialKey(['todos', { page: 1 }], ['todos']), true);
  assert.throws(() => hashQueryKey([new Date()]), TypeError);

  const cyclic = {};
  cyclic.self = cyclic;
  assert.throws(() => hashQueryKey([cyclic]), TypeError);
});

test('HTTP client preserves base paths and applies request lifecycle order', async () => {
  globalThis.window = {};
  configureReactive({ getAccessToken: async () => 'latest' });
  const calls = [];
  const client = createHttpClient({
    baseUrl: 'https://example.test/api/',
    headers: { 'X-Level': 'client' },
    requestInterceptors: [
      (url, init) => {
        calls.push('request');
        return { ...init, headers: { ...init.headers, 'X-Intercepted': 'yes' } };
      },
    ],
    responseInterceptors: [
      (response) => {
        calls.push('response');
        return response;
      },
    ],
    fetch: async (url, init) => {
      calls.push({ url, init });
      return new globalThis.Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  });

  const result = await client.post(
    '/todos?existing=1',
    { title: 'a' },
    {
      headers: { 'X-Level': 'request' },
      query: { tag: ['one', null, 'two'] },
    },
  );

  assert.deepEqual(result, { ok: true });
  assert.equal(calls[0], 'request');
  assert.equal(calls[2], 'response');
  assert.equal(calls[1].url, 'https://example.test/api/todos?existing=1&tag=one&tag=two');
  assert.equal(calls[1].init.headers.Authorization, 'Bearer latest');
  assert.equal(calls[1].init.headers['X-Level'], 'request');
  assert.equal(calls[1].init.headers['Content-Type'], 'application/json');
  assert.equal(buildUrl('/api/', '/todos', { page: 2 }), '/api/todos?page=2');
});

test('HTTP errors expose parsed response details', async () => {
  let unauthorizedCalls = 0;
  const client = createHttpClient({
    fetch: async () =>
      new globalThis.Response(JSON.stringify({ message: 'Denied' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      }),
    onUnauthorized: () => {
      unauthorizedCalls += 1;
    },
  });

  await assert.rejects(client.get('/private'), (error) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.message, 'Denied');
    assert.equal(error.status, 401);
    assert.deepEqual(error.details, { message: 'Denied' });
    return true;
  });
  assert.equal(unauthorizedCalls, 1);
});

test('query client updates, invalidates, removes, and disposes entries', () => {
  const client = createQueryClient({ defaultOptions: { queries: { gcTime: 0 } } });
  client.setQueryData(['value'], 1);
  assert.equal(client.getQueryData(['value']), 1);
  client.invalidateQueries(['value']);
  assert.equal(client.ensureQuery(['value']).state().updatedAt, undefined);
  client.removeQueries(['value']);
  assert.equal(client.getQueryData(['value']), undefined);
  client.dispose();
  client.dispose();
  assert.throws(() => client.getQueryData(['value']), /disposed/);
});

test('query signal snapshots non-reactive options', async () => {
  await new Promise((resolve, reject) =>
    createRoot((dispose) => {
      const client = createQueryClient({ defaultOptions: { queries: { gcTime: 0 } } });
      const configuredKey = ['original'];
      const options = {
        key: configuredKey,
        client,
        enabled: () => false,
        initialData: 1,
        query: async () => 2,
      };
      const query = createQuerySignal(options);
      options.key = ['replacement'];
      options.initialData = 3;
      options.query = async () => 4;

      query.refetch().then((result) => {
        assert.equal(result, 2);
        assert.equal(client.getQueryData(configuredKey), 2);
        assert.equal(client.getQueryData(['replacement']), undefined);
        client.dispose();
        dispose();
        resolve();
      }, reject);
    }),
  );
});

test('paginated query exposes server metadata after loading', async () => {
  await new Promise((resolve, reject) =>
    createRoot((dispose) => {
      const client = createQueryClient({ defaultOptions: { queries: { gcTime: 0 } } });
      const query = createPaginatedQuery({
        key: ['items'],
        client,
        enabled: () => false,
        pageSize: 20,
        query: async () => ({
          items: ['item'],
          totalCount: 1,
          page: 7,
          pageSize: 50,
          totalPages: 1,
          hasNextPage: false,
        }),
      });

      query.refetch().then(() => {
        assert.equal(query.page, 7);
        assert.equal(query.pageSize, 50);
        client.dispose();
        dispose();
        resolve();
      }, reject);
    }),
  );
});

test('mutation callbacks preserve state and all settled callbacks run', async () => {
  const events = [];
  const mutation = createMutationSignal(async (value) => value * 2, {
    onMutate: () => 'context',
    onSuccess: (result, value, context) => events.push(['success', result, value, context]),
    onSettled: (result, error, value, context) => events.push(['settled', result, error, value, context]),
  });

  assert.equal(await mutation.run(3), 6);
  assert.equal(mutation.status(), 'success');
  assert.deepEqual(events, [
    ['success', 6, 3, 'context'],
    ['settled', 6, undefined, 3, 'context'],
  ]);
});

test('local stores preserve ordering, defaults, and transactional persistence', () => {
  const entity = createEntityStore({ getId: (item) => item.id, initialItems: [{ id: 1 }, { id: 2 }] });
  entity.upsert({ id: 1, changed: true });
  assert.deepEqual(entity.ids(), [1, 2]);
  assert.equal(entity.getById(1).changed, true);

  const selection = createSelectionStore({ initialSelectedId: 0 });
  assert.equal(selection.hasSelection(), true);
  selection.clear();
  assert.equal(selection.selectedId(), null);

  const values = new Map([['count', '2']]);
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const [count, setCount] = createPersistedSignal('count', 0, { storage });
  assert.equal(count(), 2);
  setCount((value) => value + 1);
  assert.equal(values.get('count'), '3');
});

test('synchronized init is shared and cannot overwrite a local edit', async () => {
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    clear: () => values.clear(),
    key: () => null,
    get length() {
      return values.size;
    },
  };

  let resolveFetch;
  let normalizeCalls = 0;
  const fetched = new Promise((resolve) => {
    resolveFetch = resolve;
  });
  await new Promise((resolve, reject) =>
    createRoot((dispose) => {
      const synced = createSyncedStore({
        key: 'settings',
        defaultData: { count: 0 },
        fetch: () => fetched,
        save: async () => undefined,
        normalize: (data) => {
          normalizeCalls += 1;
          return { count: Number(data.count) };
        },
      });
      const first = synced.init();
      const second = synced.init();
      assert.strictEqual(first, second);
      synced.setStore('count', 1);
      resolveFetch({ count: 2 });
      first.then(() => {
        assert.equal(synced.store.count, 1);
        assert.equal(normalizeCalls, 1);
        synced.dispose();
        dispose();
        resolve();
      }, reject);
    }),
  );
});

test('infinite query normalizes non-Error page failures', async () => {
  await new Promise((resolve, reject) =>
    createRoot((dispose) => {
      const client = createQueryClient({ defaultOptions: { queries: { gcTime: 0 } } });
      const query = createInfiniteQuery({
        key: ['feed'],
        client,
        enabled: () => false,
        query: async ({ cursor }) => {
          if (cursor === undefined) return { items: [1], nextCursor: 'next' };
          throw 'page failed';
        },
      });

      query
        .refetch()
        .then(() =>
          assert.rejects(query.fetchNextPage(), (error) => {
            assert.ok(error instanceof Error);
            assert.equal(error.message, 'Query failed');
            return true;
          }),
        )
        .then(() => {
          client.dispose();
          dispose();
          resolve();
        }, reject);
    }),
  );
});
