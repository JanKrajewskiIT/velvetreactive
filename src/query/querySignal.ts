import type { Accessor } from 'solid-js';
import { createComputed, createEffect, createMemo, createSignal, onCleanup, untrack } from 'solid-js';

import { assertOwner } from '../shared/assertOwner.js';
import { ignoreRecordedFailure } from '../shared/ignoreRecordedFailure.js';
import type { TimerHandle } from '../shared/timers.js';
import { MAX_TIMER_DELAY_MS } from '../shared/timers.js';
import { useQueryClient } from './queryContext.js';
import type { QueryEntry } from './queryEntry.js';
import { resolveQueryEntry } from './queryEntry.js';
import type { QueryRequest } from './queryRetry.js';
import { createSuccessState } from './queryState.js';
import type { QueryClient, QueryKey, QueryKeyInput, QueryOptions, QueryStatus } from './queryTypes.js';

export interface CreateQuerySignalOptions<TData> extends QueryOptions<TData> {
  key: QueryKeyInput;
  query: (signal?: AbortSignal) => Promise<TData>;
  client?: QueryClient;
}

export interface QuerySignal<TData> {
  status: Accessor<QueryStatus>;
  data: Accessor<TData | undefined>;
  error: Accessor<Error | undefined>;
  updatedAt: Accessor<number | undefined>;
  isFetching: Accessor<boolean>;
  isStale: Accessor<boolean>;
  refetch: () => Promise<TData>;
  invalidate: () => void;
  setData: (updater: TData | ((previous: TData | undefined) => TData)) => void;
}

export interface QuerySource<TData> {
  readonly key: QueryKey;
  readonly load: (signal: AbortSignal) => Promise<TData>;
}

export interface SourcedQuerySignalOptions<TData> extends QueryOptions<TData> {
  source: Accessor<QuerySource<TData>>;
  client?: QueryClient;
}

const isAlwaysEnabled = (): boolean => true;

const seedInitialData = <TData>(entry: QueryEntry<TData>, initialData: TData): void => {
  if (untrack(entry.state).status === 'idle') {
    entry.setState(createSuccessState(initialData, undefined));
  }
};

const createStaleness = (updatedAt: Accessor<number | undefined>, staleTime: number): Accessor<boolean> => {
  const [clock, setClock] = createSignal(0);
  const freshUntil = createMemo(() => {
    const lastUpdate = updatedAt();
    return lastUpdate === undefined || staleTime <= 0 ? undefined : lastUpdate + staleTime;
  });

  createEffect(() => {
    const staticDeadline = freshUntil();
    if (staticDeadline === undefined || !Number.isFinite(staticDeadline)) {
      return;
    }
    let timer: TimerHandle | undefined;
    const schedule = (): void => {
      const remainingMs = staticDeadline - Date.now() + 1;
      if (remainingMs <= 0) {
        setClock((tick) => tick + 1);
        return;
      }
      timer = setTimeout(schedule, Math.min(remainingMs, MAX_TIMER_DELAY_MS));
    };
    schedule();
    onCleanup(() => {
      clearTimeout(timer);
    });
  });

  return createMemo(() => {
    clock();
    const deadline = freshUntil();
    return deadline === undefined || Date.now() > deadline;
  });
};

export const createSourcedQuerySignal = <TData>(options: SourcedQuerySignalOptions<TData>): QuerySignal<TData> => {
  assertOwner('Query primitives');
  const client = options.client ?? useQueryClient();
  const { defaults } = client;
  const staleTime = options.staleTime ?? defaults.staleTime;
  const retry = options.retry ?? defaults.retry;
  const retryDelay = options.retryDelay ?? defaults.retryDelay;
  const { initialData } = options;
  const isEnabled = options.enabled ?? isAlwaysEnabled;

  const source = createMemo(options.source);
  const entry = createMemo(() => resolveQueryEntry<TData>(client, source().key));
  const state = () => entry().state();
  const createRequest = (): QueryRequest<TData> => ({ load: source().load, retry, retryDelay });
  const isStale = createStaleness(() => state().updatedAt, staleTime);

  if (initialData !== undefined) {
    createComputed(() => {
      seedInitialData(entry(), initialData);
    });
  }

  createEffect(() => {
    onCleanup(entry().observe());
  });

  createEffect(() => {
    const current = entry();
    current.invalidations();
    if (!isEnabled() || !isStale()) {
      return;
    }
    current.fetch(untrack(createRequest)).catch(ignoreRecordedFailure);
  });

  return {
    status: () => state().status,
    data: () => state().data,
    error: () => state().error,
    updatedAt: () => state().updatedAt,
    isFetching: () => state().isFetching,
    isStale,
    refetch: () => untrack(() => entry().fetch(createRequest())),
    invalidate: () => {
      untrack(entry).invalidate();
    },
    setData: (updater) => {
      client.setQueryData(untrack(source).key, updater);
    },
  };
};

export const toQuerySource = <TData>(
  key: QueryKeyInput,
  query: (signal?: AbortSignal) => Promise<TData>,
): Accessor<QuerySource<TData>> => {
  const resolveKey: Accessor<QueryKey> = typeof key === 'function' ? key : () => key;
  return () => ({ key: resolveKey(), load: (signal) => query(signal) });
};

export const createQuerySignal = <TData>(options: CreateQuerySignalOptions<TData>): QuerySignal<TData> => {
  const { key, query, ...queryOptions } = options;
  return createSourcedQuerySignal({ ...queryOptions, source: toQuerySource(key, query) });
};
