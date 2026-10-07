import { batch, untrack } from 'solid-js';

import { MAX_TIMER_DELAY_MS } from '../shared/timers.js';
import { applyUpdater } from '../shared/updater.js';
import type { QueryEntry } from './queryEntry.js';
import { createQueryEntry } from './queryEntry.js';
import { hashQueryKey, isNormalizedKeyPrefix, normalizeQueryKey } from './queryKey.js';
import { createSuccessState } from './queryState.js';
import type { CreateQueryClientOptions, QueryClient, QueryDefaults, QueryKey } from './queryTypes.js';

const DEFAULT_STALE_TIME_MS = 0;
const DEFAULT_RETRY = 0;
const DEFAULT_GC_TIME_MS = 300_000;
const MIN_GC_SWEEP_INTERVAL_MS = 30_000;
const BASE_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 30_000;
const DISPOSED_MESSAGE = 'QueryClient has been disposed';

const defaultRetryDelay = (attempt: number): number =>
  Math.min(BASE_RETRY_DELAY_MS * 2 ** (attempt - 1), MAX_RETRY_DELAY_MS);

const resolveQueryDefaults = (overrides: Partial<QueryDefaults> = {}): Readonly<QueryDefaults> =>
  Object.freeze({
    staleTime: overrides.staleTime ?? DEFAULT_STALE_TIME_MS,
    retry: overrides.retry ?? DEFAULT_RETRY,
    retryDelay: overrides.retryDelay ?? defaultRetryDelay,
    gcTime: overrides.gcTime ?? DEFAULT_GC_TIME_MS,
  });

// The registry holds entries of unrelated data types; each caller restores its own type at the boundary.
type RegisteredEntry = QueryEntry<unknown>;

export const createQueryClient = (options: CreateQueryClientOptions = {}): QueryClient => {
  const defaults = resolveQueryDefaults(options.defaultOptions?.queries);
  const entries = new Map<string, RegisteredEntry>();
  const isGcEnabled = Number.isFinite(defaults.gcTime) && defaults.gcTime > 0;
  const gcSweepIntervalMs = Math.min(Math.max(defaults.gcTime / 2, MIN_GC_SWEEP_INTERVAL_MS), MAX_TIMER_DELAY_MS);
  let gcTimer: ReturnType<typeof setInterval> | undefined;
  let isDisposed = false;

  const assertActive = (): void => {
    if (isDisposed) {
      throw new Error(DISPOSED_MESSAGE);
    }
  };

  const stopGc = (): void => {
    clearInterval(gcTimer);
    gcTimer = undefined;
  };

  const sweep = (): void => {
    const now = Date.now();
    for (const [hash, entry] of entries) {
      if (now - entry.lastAccessedAt() > defaults.gcTime && !entry.isActive()) {
        entries.delete(hash);
      }
    }
    if (entries.size === 0) {
      stopGc();
    }
  };

  const startGc = (): void => {
    if (isGcEnabled && gcTimer === undefined) {
      gcTimer = setInterval(sweep, gcSweepIntervalMs);
    }
  };

  const ensureEntry = <TData>(key: QueryKey): QueryEntry<TData> => {
    const normalizedKey = normalizeQueryKey(key);
    const hash = JSON.stringify(normalizedKey);
    const existing = entries.get(hash);
    if (existing !== undefined) {
      existing.touch();
      return existing as QueryEntry<TData>;
    }
    const created = createQueryEntry<TData>(normalizedKey);
    entries.set(hash, created as QueryEntry<unknown>);
    startGc();
    return created;
  };

  const findMatching = (partialKey: QueryKey | undefined): [string, RegisteredEntry][] => {
    if (partialKey === undefined) {
      return [...entries];
    }
    const prefix = normalizeQueryKey(partialKey);
    return [...entries].filter(([, entry]) => isNormalizedKeyPrefix(entry.key, prefix));
  };

  return {
    defaults,
    ensureQuery: <TData>(key: QueryKey) => {
      assertActive();
      return ensureEntry<TData>(key);
    },
    getQueryData: (key) => {
      assertActive();
      const entry = entries.get(hashQueryKey(key));
      if (entry === undefined) {
        return undefined;
      }
      entry.touch();
      return untrack(entry.state).data;
    },
    setQueryData: <TData>(key: QueryKey, updater: TData | ((previous: TData | undefined) => TData)) => {
      assertActive();
      ensureEntry<TData>(key).setState((previous) =>
        createSuccessState(applyUpdater<TData, TData | undefined>(updater, previous.data), Date.now()),
      );
    },
    invalidateQueries: (partialKey) => {
      assertActive();
      batch(() => {
        for (const [, entry] of findMatching(partialKey)) {
          entry.invalidate();
        }
      });
    },
    removeQueries: (partialKey) => {
      assertActive();
      for (const [hash] of findMatching(partialKey)) {
        entries.delete(hash);
      }
    },
    dispose: () => {
      if (isDisposed) {
        return;
      }
      isDisposed = true;
      for (const entry of entries.values()) {
        entry.abort();
      }
      entries.clear();
      stopGc();
    },
  };
};
