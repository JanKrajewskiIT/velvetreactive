import { type Accessor, createSignal, type Setter } from 'solid-js';

import { hashQueryKey, matchesPartialKey, type QueryKey } from './query-key.js';

export type QueryStatus = 'idle' | 'loading' | 'success' | 'error';
export type QueryRetry = number | ((attempt: number, error: Error) => boolean);
export type QueryRetryDelay = number | ((attempt: number) => number);

export interface QueryState<TData> {
  status: QueryStatus;
  data: TData | undefined;
  error: Error | undefined;
  updatedAt: number | undefined;
  isFetching: boolean;
}

export interface QueryDefaults {
  staleTime: number;
  retry: QueryRetry;
  retryDelay: QueryRetryDelay;
  gcTime: number;
}

export interface CreateQueryClientOptions {
  defaultOptions?: { queries?: Partial<QueryDefaults> };
}

export interface QueryEntryView<TData> {
  state: Accessor<QueryState<TData>>;
  setState(next: QueryState<TData> | ((previous: QueryState<TData>) => QueryState<TData>)): void;
  readonly inFlight: Promise<TData> | null;
  invalidate(): void;
}

export interface QueryClient {
  ensureQuery<TData>(key: QueryKey): QueryEntryView<TData>;
  getQueryData(key: QueryKey): unknown;
  setQueryData<TData>(key: QueryKey, updater: TData | ((previous: TData | undefined) => TData)): void;
  invalidateQueries(partialKey?: QueryKey): void;
  removeQueries(partialKey?: QueryKey): void;
  dispose(): void;
  defaults: QueryDefaults;
}

interface QueryEntry<TData = unknown> {
  key: QueryKey;
  state: Accessor<QueryState<TData>>;
  setState: Setter<QueryState<TData>>;
  inFlight: Promise<TData> | null;
  controller: AbortController | null;
  observers: Set<symbol>;
  invalidationRevision: Accessor<number>;
  bumpInvalidation: Setter<number>;
  lastAccessedAt: number;
  view: QueryEntryView<TData>;
}

interface QueryClientInternals {
  assertActive(): void;
  getEntry<TData>(key: QueryKey): QueryEntry<TData>;
}

const clientInternals = new WeakMap<QueryClient, QueryClientInternals>();

const defaultRetryDelay = (attempt: number): number => Math.min(1000 * 2 ** (attempt - 1), 30000);

const initialState = <TData>(): QueryState<TData> => ({
  status: 'idle',
  data: undefined,
  error: undefined,
  updatedAt: undefined,
  isFetching: false,
});

export const createQueryClient = (options: CreateQueryClientOptions = {}): QueryClient => {
  const defaults: QueryDefaults = {
    staleTime: 0,
    retry: 0,
    retryDelay: defaultRetryDelay,
    gcTime: 300000,
    ...options.defaultOptions?.queries,
  };
  const entries = new Map<string, QueryEntry>();
  let disposed = false;
  let gcTimer: ReturnType<typeof setInterval> | undefined;

  const assertActive = (): void => {
    if (disposed) throw new Error('QueryClient has been disposed');
  };

  const stopGcWhenEmpty = (): void => {
    if (entries.size === 0 && gcTimer !== undefined) {
      clearInterval(gcTimer);
      gcTimer = undefined;
    }
  };

  const collect = (): void => {
    const now = Date.now();
    for (const [hash, entry] of entries) {
      const state = entry.state();
      if (entry.inFlight === null && state.status !== 'loading' && now - entry.lastAccessedAt > defaults.gcTime) {
        entries.delete(hash);
      }
    }
    stopGcWhenEmpty();
  };

  const startGc = (): void => {
    if (defaults.gcTime > 0 && gcTimer === undefined) {
      gcTimer = setInterval(collect, Math.max(defaults.gcTime / 2, 30000));
    }
  };

  const getEntry = <TData>(key: QueryKey): QueryEntry<TData> => {
    assertActive();
    const hash = hashQueryKey(key);
    const existing = entries.get(hash) as QueryEntry<TData> | undefined;
    if (existing !== undefined) {
      existing.lastAccessedAt = Date.now();
      return existing;
    }

    const [state, setState] = createSignal(initialState<TData>());
    const [invalidationRevision, bumpInvalidation] = createSignal(0);
    const entry = {
      key,
      state,
      setState,
      inFlight: null,
      controller: null,
      observers: new Set<symbol>(),
      invalidationRevision,
      bumpInvalidation,
      lastAccessedAt: Date.now(),
    } as QueryEntry<TData>;
    entry.view = {
      state,
      setState: (next) => setState(next),
      get inFlight() {
        return entry.inFlight;
      },
      invalidate: () => {
        assertActive();
        setState((previous) => ({ ...previous, updatedAt: undefined }));
        bumpInvalidation((revision) => revision + 1);
      },
    };
    entries.set(hash, entry as QueryEntry);
    startGc();
    return entry;
  };

  const client: QueryClient = {
    defaults,
    ensureQuery: <TData>(key: QueryKey) => getEntry<TData>(key).view,
    getQueryData: (key) => {
      assertActive();
      const entry = entries.get(hashQueryKey(key));
      if (entry === undefined) return undefined;
      entry.lastAccessedAt = Date.now();
      return entry.state().data;
    },
    setQueryData: <TData>(key: QueryKey, updater: TData | ((previous: TData | undefined) => TData)) => {
      const entry = getEntry<TData>(key);
      const previous = entry.state().data;
      const data = typeof updater === 'function' ? (updater as (value: TData | undefined) => TData)(previous) : updater;
      entry.setState({ status: 'success', data, error: undefined, updatedAt: Date.now(), isFetching: false });
    },
    invalidateQueries: (partialKey) => {
      assertActive();
      for (const entry of entries.values()) {
        if (partialKey === undefined || matchesPartialKey(entry.key, partialKey)) entry.view.invalidate();
      }
    },
    removeQueries: (partialKey) => {
      assertActive();
      if (partialKey === undefined) entries.clear();
      else {
        for (const [hash, entry] of entries) {
          if (matchesPartialKey(entry.key, partialKey)) entries.delete(hash);
        }
      }
      stopGcWhenEmpty();
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      for (const entry of entries.values()) entry.controller?.abort();
      entries.clear();
      if (gcTimer !== undefined) clearInterval(gcTimer);
      gcTimer = undefined;
    },
  };

  clientInternals.set(client, { assertActive, getEntry });
  return client;
};

export const getQueryClientInternals = (client: QueryClient): QueryClientInternals => {
  const internals = clientInternals.get(client);
  if (internals === undefined) throw new TypeError('Unsupported QueryClient implementation');
  internals.assertActive();
  return internals;
};

export type { QueryEntry };
