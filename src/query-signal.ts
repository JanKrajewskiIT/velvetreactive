import { type Accessor, createEffect, createMemo, createSignal, on, onCleanup, untrack } from 'solid-js';

import { getQueryClientInternals, type QueryClient, type QueryState, type QueryStatus } from './query-client.js';
import { useQueryClient } from './query-context.js';
import { hashQueryKey, type QueryKey } from './query-key.js';

export type QueryKeyInput = QueryKey | Accessor<QueryKey>;

export interface QueryOptions<TData> {
  staleTime?: number;
  retry?: number | ((attempt: number, error: Error) => boolean);
  retryDelay?: number | ((attempt: number) => number);
  enabled?: Accessor<boolean>;
  initialData?: TData;
}

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
  refetch(): Promise<TData>;
  invalidate(): void;
  setData(updater: TData | ((previous: TData | undefined) => TData)): void;
}

const normalizeQueryError = (value: unknown): Error => (value instanceof Error ? value : new Error('Query failed'));

const throwIfQueryAborted = (signal: AbortSignal): void => {
  if (signal.aborted) throw new Error('Query aborted');
};

const waitForRetry = (delay: number, signal: AbortSignal): Promise<void> => {
  if (delay <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, delay);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new Error('Query aborted'));
      },
      { once: true },
    );
  });
};

export const createQuerySignal = <TData>(options: CreateQuerySignalOptions<TData>): QuerySignal<TData> => {
  const client = options.client ?? useQueryClient();
  const internals = getQueryClientInternals(client);
  const configuredKey = options.key;
  const query = options.query;
  const initialData = options.initialData;
  const keyAccessor: Accessor<QueryKey> = typeof configuredKey === 'function' ? configuredKey : () => configuredKey;
  const enabled = options.enabled ?? (() => true);
  const staleTime = options.staleTime ?? client.defaults.staleTime;
  const retry = options.retry ?? client.defaults.retry;
  const retryDelay = options.retryDelay ?? client.defaults.retryDelay;
  const observer = Symbol('query-observer');
  const [staleRevision, setStaleRevision] = createSignal(0);
  const entry = createMemo(() => internals.getEntry<TData>(keyAccessor()));

  createEffect(
    on(entry, (current, previous) => {
      previous?.observers.delete(observer);
      if (previous !== undefined && previous.observers.size === 0) previous.controller?.abort();
      current.observers.add(observer);
      const state = current.state();
      if (initialData !== undefined && state.status === 'idle') {
        current.setState({
          status: 'success',
          data: initialData,
          error: undefined,
          updatedAt: undefined,
          isFetching: false,
        });
      }
    }),
  );

  onCleanup(() => {
    const current = untrack(entry);
    current.observers.delete(observer);
    if (current.observers.size === 0) current.controller?.abort();
  });

  const state = createMemo<QueryState<TData>>(() => entry().state());
  const isStale = createMemo(() => {
    staleRevision();
    const updatedAt = state().updatedAt;
    return updatedAt === undefined || staleTime <= 0 || Date.now() - updatedAt > staleTime;
  });

  createEffect(() => {
    const updatedAt = state().updatedAt;
    if (updatedAt === undefined || staleTime <= 0) return;
    const remaining = Math.max(staleTime - (Date.now() - updatedAt) + 1, 0);
    const timer = setTimeout(() => setStaleRevision((revision) => revision + 1), remaining);
    onCleanup(() => clearTimeout(timer));
  });

  const refetch = (): Promise<TData> => {
    const current = entry();
    if (current.inFlight !== null) return current.inFlight;

    const controller = new AbortController();
    const wasAborted = (): boolean => controller.signal.aborted;
    current.controller = controller;
    current.setState((previous) => ({
      ...previous,
      status: previous.status === 'idle' ? 'loading' : previous.status,
      error: undefined,
      isFetching: true,
    }));

    const task = (async (): Promise<TData> => {
      let attempt = 1;
      for (;;) {
        try {
          const data = await query(controller.signal);
          throwIfQueryAborted(controller.signal);
          current.setState({
            status: 'success',
            data,
            error: undefined,
            updatedAt: Date.now(),
            isFetching: false,
          });
          return data;
        } catch (reason) {
          if (wasAborted()) {
            const error = reason instanceof Error ? reason : new Error('Query aborted');
            current.setState((previous) => ({
              ...previous,
              status: previous.data === undefined ? 'idle' : previous.status,
              error: previous.data === undefined ? undefined : previous.error,
              isFetching: false,
            }));
            throw error;
          }
          const error = normalizeQueryError(reason);
          const shouldRetry = typeof retry === 'function' ? retry(attempt, error) : attempt <= retry;
          if (!shouldRetry) {
            current.setState((previous) => ({ ...previous, status: 'error', error, isFetching: false }));
            throw error;
          }
          const delay = typeof retryDelay === 'function' ? retryDelay(attempt) : retryDelay;
          try {
            await waitForRetry(delay, controller.signal);
          } catch (abortReason) {
            current.setState((previous) => ({
              ...previous,
              status: previous.data === undefined ? 'idle' : previous.status,
              error: previous.data === undefined ? undefined : previous.error,
              isFetching: false,
            }));
            throw abortReason;
          }
          attempt += 1;
        }
      }
    })();
    const operation = task.finally(() => {
      if (current.inFlight === operation) current.inFlight = null;
      if (current.controller === controller) current.controller = null;
    });
    current.inFlight = operation;
    return operation;
  };

  createEffect(
    on(
      () => [hashQueryKey(keyAccessor()), enabled(), staleRevision()] as const,
      () => {
        if (enabled() && untrack(isStale)) void refetch().catch(() => undefined);
      },
    ),
  );

  createEffect(
    on(
      () => [entry(), entry().invalidationRevision()] as const,
      (current, previous) => {
        if (previous !== undefined && current[1] !== previous[1] && enabled()) {
          void refetch().catch(() => undefined);
        }
      },
    ),
  );

  return {
    status: () => state().status,
    data: () => state().data,
    error: () => state().error,
    updatedAt: () => state().updatedAt,
    isFetching: () => state().isFetching,
    isStale,
    refetch,
    invalidate: () => entry().view.invalidate(),
    setData: (updater) => client.setQueryData(keyAccessor(), updater),
  };
};
