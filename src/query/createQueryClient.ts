import { type Accessor, createSignal } from 'solid-js';

import { hashQueryKey, matchesPartialKey } from './key';
import type { CreateQueryClientOptions, QueryDefaults, QueryKey, QueryState } from './types';

export interface QueryClientEntry<TData = unknown> {
  state: Accessor<QueryState<TData>>;
  setState: (next: QueryState<TData> | ((previous: QueryState<TData>) => QueryState<TData>)) => void;
  inFlight: Promise<TData> | null;
  invalidate: () => void;
}

export interface QueryClient {
  ensureQuery<TData>(key: QueryKey): QueryClientEntry<TData>;
  getQueryData(key: QueryKey): unknown;
  setQueryData<TData>(key: QueryKey, updater: TData | ((previous: TData | undefined) => TData)): void;
  invalidateQueries(partialKey?: QueryKey): void;
  removeQueries(partialKey?: QueryKey): void;
  defaults: QueryDefaults;
}

const DEFAULT_QUERY_DEFAULTS: QueryDefaults = {
  staleTime: 0,
  retry: 0,
  retryDelay: (attempt: number) => Math.min(1000 * 2 ** (attempt - 1), 30000),
  gcTime: 5 * 60 * 1000,
};

export const createQueryClient = (options: CreateQueryClientOptions = {}): QueryClient => {
  const cache = new Map<string, { key: QueryKey; entry: QueryClientEntry<unknown>; lastAccessedAt: number }>();
  const defaults: QueryDefaults = {
    ...DEFAULT_QUERY_DEFAULTS,
    ...(options.defaultOptions?.queries ?? {}),
  };

  let gcTimer: ReturnType<typeof setInterval> | undefined;

  const startGc = () => {
    if (gcTimer || defaults.gcTime <= 0) {
      return;
    }

    gcTimer = setInterval(
      () => {
        const now = Date.now();
        cache.forEach((record, hash) => {
          const state = record.entry.state();
          if (!record.entry.inFlight && state.status !== 'loading' && now - record.lastAccessedAt > defaults.gcTime) {
            cache.delete(hash);
          }
        });

        if (cache.size === 0 && gcTimer) {
          clearInterval(gcTimer);
          gcTimer = undefined;
        }
      },
      Math.max(defaults.gcTime / 2, 30000),
    );
  };

  const ensureQuery = <TData>(key: QueryKey): QueryClientEntry<TData> => {
    const keyHash = hashQueryKey(key);
    const existing = cache.get(keyHash);
    if (existing) {
      existing.lastAccessedAt = Date.now();
      return existing.entry as QueryClientEntry<TData>;
    }

    const [state, setState] = createSignal<QueryState<TData>>({
      status: 'idle',
      data: undefined,
      error: undefined,
      updatedAt: undefined,
      isFetching: false,
    });

    const entry: QueryClientEntry<TData> = {
      state,
      setState,
      inFlight: null,
      invalidate: () => {
        setState((previous) => ({
          ...previous,
          updatedAt: undefined,
        }));
      },
    };

    cache.set(keyHash, { key, entry: entry as QueryClientEntry<unknown>, lastAccessedAt: Date.now() });
    startGc();
    return entry;
  };

  const getQueryData = (key: QueryKey): unknown => {
    const keyHash = hashQueryKey(key);
    const record = cache.get(keyHash);
    if (!record) {
      return undefined;
    }

    record.lastAccessedAt = Date.now();
    return record.entry.state().data;
  };

  const setQueryData = <TData>(key: QueryKey, updater: TData | ((previous: TData | undefined) => TData)): void => {
    const entry = ensureQuery<TData>(key);

    entry.setState((previous) => {
      const nextData =
        typeof updater === 'function' ? (updater as (data: TData | undefined) => TData)(previous.data) : updater;
      return {
        status: 'success',
        data: nextData,
        error: undefined,
        updatedAt: Date.now(),
        isFetching: false,
      };
    });
  };

  const invalidateQueries = (partialKey?: QueryKey): void => {
    cache.forEach((record) => {
      if (!partialKey) {
        record.entry.invalidate();
        return;
      }

      if (matchesPartialKey(record.key, partialKey)) {
        record.entry.invalidate();
      }
    });
  };

  const removeQueries = (partialKey?: QueryKey): void => {
    if (!partialKey) {
      cache.clear();
      return;
    }

    cache.forEach((record, hash) => {
      if (matchesPartialKey(record.key, partialKey)) {
        cache.delete(hash);
      }
    });
  };

  return {
    ensureQuery,
    getQueryData,
    setQueryData,
    invalidateQueries,
    removeQueries,
    defaults,
  };
};
