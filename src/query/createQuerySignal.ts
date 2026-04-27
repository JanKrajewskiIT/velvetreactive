import { createEffect, createMemo, createSignal, onCleanup } from 'solid-js';

import type { QueryClient } from './createQueryClient';
import { useQueryClient } from './queryClientContext';
import type { QueryKeyInput, QueryOptions, QueryRetry, QueryRetryDelay, QuerySignal, QueryState } from './types';

export interface CreateQuerySignalOptions<TData> extends QueryOptions<TData> {
  key: QueryKeyInput;
  query: (signal?: AbortSignal) => Promise<TData>;
  client?: QueryClient;
}

const resolveRetryDelay = (attempt: number, retryDelay: QueryRetryDelay): number => {
  if (typeof retryDelay === 'number') {
    return retryDelay;
  }

  return retryDelay(attempt);
};

const shouldRetry = (attempt: number, error: Error, retryOption: QueryRetry): boolean => {
  if (typeof retryOption === 'number') {
    return attempt <= retryOption;
  }

  return retryOption(attempt, error);
};

const delay = (ms: number, signal: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason as Error);
      return;
    }

    const timer = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason as Error);
    };

    signal.addEventListener('abort', onAbort, { once: true });
  });

export const createQuerySignal = <TData>(options: CreateQuerySignalOptions<TData>): QuerySignal<TData> => {
  const client = options.client ?? useQueryClient();
  const staleTime = options.staleTime ?? client.defaults.staleTime;
  const retry = options.retry ?? client.defaults.retry;
  const retryDelay = options.retryDelay ?? client.defaults.retryDelay;
  const [activeAbort, setActiveAbort] = createSignal<AbortController | undefined>(undefined);

  const resolveKey = () => (typeof options.key === 'function' ? options.key() : options.key);
  const resolveEntry = () => client.ensureQuery<TData>(resolveKey());

  const runQueryWithRetry = async (signal: AbortSignal): Promise<TData> => {
    let attempt = 0;

    for (;;) {
      attempt += 1;
      try {
        return await options.query(signal);
      } catch (error: unknown) {
        if (signal.aborted) {
          throw error instanceof Error ? error : new Error('Query aborted');
        }

        const normalized = error instanceof Error ? error : new Error('Query failed');
        if (!shouldRetry(attempt, normalized, retry)) {
          throw normalized;
        }

        const delayMs = resolveRetryDelay(attempt, retryDelay);
        if (delayMs > 0) {
          await delay(delayMs, signal);
        }
      }
    }
  };

  createEffect(() => {
    const currentEntry = resolveEntry();
    if (options.initialData === undefined || currentEntry.state().status !== 'idle') {
      return;
    }

    currentEntry.setState({
      status: 'success',
      data: options.initialData,
      error: undefined,
      updatedAt: undefined,
      isFetching: false,
    });
  });

  const isStale = createMemo(() => {
    const state = resolveEntry().state();
    if (state.updatedAt === undefined) {
      return true;
    }

    if (staleTime <= 0) {
      return true;
    }

    return Date.now() - state.updatedAt > staleTime;
  });

  const refetch = async (): Promise<TData> => {
    const currentEntry = resolveEntry();

    if (currentEntry.inFlight) {
      return currentEntry.inFlight;
    }

    activeAbort()?.abort();
    const controller = new AbortController();
    setActiveAbort(controller);

    currentEntry.setState((previous: QueryState<TData>) => ({
      ...previous,
      status: previous.status === 'idle' ? 'loading' : previous.status,
      isFetching: true,
      error: undefined,
    }));

    const pending = runQueryWithRetry(controller.signal)
      .then((data) => {
        currentEntry.setState({
          status: 'success',
          data,
          error: undefined,
          updatedAt: Date.now(),
          isFetching: false,
        });
        return data;
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          throw error instanceof Error ? error : new Error('Query aborted');
        }

        const normalized = error instanceof Error ? error : new Error('Query failed');
        currentEntry.setState((previous: QueryState<TData>) => ({
          ...previous,
          status: 'error',
          error: normalized,
          isFetching: false,
        }));
        throw normalized;
      })
      .finally(() => {
        if (Object.is(currentEntry.inFlight, pending)) {
          currentEntry.inFlight = null;
        }
      });

    currentEntry.inFlight = pending;
    return pending;
  };

  const invalidate = () => {
    resolveEntry().invalidate();
  };

  const setData = (updater: TData | ((previous: TData | undefined) => TData)) => {
    client.setQueryData(resolveKey(), updater);
  };

  const status = createMemo(() => resolveEntry().state().status);
  const data = createMemo(() => resolveEntry().state().data);
  const error = createMemo(() => resolveEntry().state().error);
  const updatedAt = createMemo(() => resolveEntry().state().updatedAt);
  const isFetching = createMemo(() => resolveEntry().state().isFetching);

  createEffect(() => {
    resolveKey();
    const enabled = options.enabled?.() ?? true;
    const stale = isStale();

    if (!enabled || !stale) {
      return;
    }

    activeAbort()?.abort();
    void refetch();
  });

  onCleanup(() => {
    activeAbort()?.abort();
  });

  return {
    status,
    data,
    error,
    updatedAt,
    isFetching,
    isStale,
    refetch,
    invalidate,
    setData,
  };
};
