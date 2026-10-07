import type { Accessor } from 'solid-js';
import { batch, createSignal, untrack } from 'solid-js';

import { createAbortError } from '../shared/abort.js';
import { toError } from '../shared/toError.js';
import { applyUpdater } from '../shared/updater.js';
import type { NormalizedQueryKey } from './queryKey.js';
import type { QueryRequest } from './queryRetry.js';
import { runWithRetry } from './queryRetry.js';
import { createIdleState, createSuccessState, toAbortedState, toFailedState, toFetchingState } from './queryState.js';
import type { QueryClient, QueryEntryHandle, QueryKey, QueryState } from './queryTypes.js';

export interface QueryEntry<TData> extends QueryEntryHandle<TData> {
  readonly key: NormalizedQueryKey;
  readonly invalidations: Accessor<number>;
  readonly lastAccessedAt: () => number;
  readonly touch: () => void;
  readonly isActive: () => boolean;
  readonly observe: () => () => void;
  readonly fetch: (request: QueryRequest<TData>) => Promise<TData>;
  readonly abort: () => void;
}

interface ActiveFetch<TData> {
  readonly controller: AbortController;
  readonly promise: Promise<TData>;
}

const createdEntries = new WeakSet<object>();

export const isQueryEntry = <TData>(handle: QueryEntryHandle<TData>): handle is QueryEntry<TData> =>
  createdEntries.has(handle);

export const resolveQueryEntry = <TData>(client: QueryClient, key: QueryKey): QueryEntry<TData> => {
  const handle = client.ensureQuery<TData>(key);
  if (!isQueryEntry(handle)) {
    throw new TypeError('The query client must be created with createQueryClient.');
  }
  return handle;
};

export const createQueryEntry = <TData>(key: NormalizedQueryKey): QueryEntry<TData> => {
  const [state, setState] = createSignal<QueryState<TData>>(createIdleState<TData>());
  const [invalidations, setInvalidations] = createSignal(0);
  let activeFetch: ActiveFetch<TData> | null = null;
  let observerCount = 0;
  let lastAccessedAt = Date.now();

  const abort = (): void => {
    if (activeFetch === null) {
      return;
    }
    const { controller } = activeFetch;
    activeFetch = null;
    controller.abort(createAbortError('Query aborted'));
    setState(toAbortedState);
  };

  const release = (controller: AbortController): void => {
    if (activeFetch?.controller === controller) {
      activeFetch = null;
    }
  };

  const execute = async (request: QueryRequest<TData>, controller: AbortController): Promise<TData> => {
    let data: TData;
    try {
      data = await runWithRetry(request, controller.signal);
      controller.signal.throwIfAborted();
    } catch (thrown) {
      release(controller);
      if (controller.signal.aborted) {
        throw thrown instanceof Error ? thrown : toError(controller.signal.reason, 'Query aborted');
      }
      const error = toError(thrown, 'Query failed');
      setState((previous) => toFailedState(previous, error));
      throw error;
    }
    release(controller);
    setState(createSuccessState(data, Date.now()));
    return data;
  };

  const runFetch = (request: QueryRequest<TData>): Promise<TData> => {
    if (activeFetch !== null) {
      return activeFetch.promise;
    }
    const controller = new AbortController();
    setState(toFetchingState);
    const promise = execute(request, controller);
    activeFetch = { controller, promise };
    return promise;
  };

  const observe = (): (() => void) => {
    observerCount += 1;
    let isDetached = false;
    return () => {
      if (isDetached) {
        return;
      }
      isDetached = true;
      observerCount -= 1;
      if (observerCount === 0) {
        abort();
      }
    };
  };

  const entry: QueryEntry<TData> = {
    key,
    state,
    setState: (next) => {
      setState((previous) => applyUpdater(next, previous));
    },
    get inFlight() {
      return activeFetch?.promise ?? null;
    },
    invalidate: () => {
      batch(() => {
        setState((previous) => ({ ...previous, updatedAt: undefined }));
        setInvalidations((count) => count + 1);
      });
    },
    invalidations,
    lastAccessedAt: () => lastAccessedAt,
    touch: () => {
      lastAccessedAt = Date.now();
    },
    isActive: () => observerCount > 0 || activeFetch !== null || untrack(state).status === 'loading',
    observe,
    fetch: runFetch,
    abort,
  };
  createdEntries.add(entry);
  return entry;
};
