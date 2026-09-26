import { type Accessor, createEffect, on } from 'solid-js';

import { createMutationController, type MutationOptions } from './mutation.js';
import { type QueryClient } from './query-client.js';
import { useQueryClient } from './query-context.js';
import type { QueryKey } from './query-key.js';
import { createQuerySignal, type CreateQuerySignalOptions } from './query-signal.js';

export interface AuthStateAdapter {
  isAuthenticated: Accessor<boolean>;
  user: Accessor<unknown>;
  accessToken: Accessor<string | undefined>;
}

export interface CreateAppQueryOptions<TData> extends Omit<CreateQuerySignalOptions<TData>, 'client'> {
  client?: QueryClient;
  auth?: AuthStateAdapter;
  watch?: Accessor<unknown>;
  select?: (data: TData) => unknown;
}

export interface AppQueryResult<TData> {
  readonly data: TData | undefined;
  readonly error: Error | undefined;
  readonly isError: boolean;
  readonly isFetching: boolean;
  readonly isLoading: boolean;
  readonly isSuccess: boolean;
  invalidate(): void;
  refetch(): Promise<TData>;
}

export function createAppQuery<TData, TSelected>(
  options: CreateAppQueryOptions<TData> & { select: (data: TData) => TSelected },
): AppQueryResult<TSelected>;
export function createAppQuery<TData>(options: CreateAppQueryOptions<TData>): AppQueryResult<TData>;
export function createAppQuery<TData, TSelected>(
  options: CreateAppQueryOptions<TData> & { select?: (data: TData) => TSelected },
): AppQueryResult<TData | TSelected> {
  const select = options.select as ((data: TData) => TSelected) | undefined;
  const ownEnabled = options.enabled ?? (() => true);
  const authReady = (): boolean =>
    options.auth === undefined ||
    options.auth.isAuthenticated() ||
    options.auth.accessToken() !== undefined ||
    (options.auth.user() !== null && options.auth.user() !== undefined);
  const query = createQuerySignal({
    key: options.key,
    query: options.query,
    ...(options.client === undefined ? {} : { client: options.client }),
    ...(options.staleTime === undefined ? {} : { staleTime: options.staleTime }),
    ...(options.retry === undefined ? {} : { retry: options.retry }),
    ...(options.retryDelay === undefined ? {} : { retryDelay: options.retryDelay }),
    ...(options.initialData === undefined ? {} : { initialData: options.initialData }),
    enabled: () => ownEnabled() && authReady(),
  });

  if (options.auth !== undefined) {
    createEffect(on(options.auth.accessToken, () => query.invalidate(), { defer: true }));
  }
  if (options.watch !== undefined) {
    createEffect(on(options.watch, () => query.invalidate(), { defer: true }));
  }

  return {
    get data() {
      const data = query.data();
      return data === undefined || select === undefined ? data : select(data);
    },
    get error() {
      return query.error();
    },
    get isError() {
      return query.status() === 'error';
    },
    get isFetching() {
      return query.isFetching();
    },
    get isLoading() {
      return query.status() === 'loading';
    },
    get isSuccess() {
      return query.status() === 'success';
    },
    invalidate: () => query.invalidate(),
    refetch: async () => {
      const data = await query.refetch();
      return select === undefined ? data : select(data);
    },
  };
}

export type MutationCallbacks<TData, TVariables, TContext = unknown> = MutationOptions<TData, TVariables, TContext>;

export interface CreateAppMutationOptions<TData, TVariables, TContext = unknown> extends MutationOptions<
  TData,
  TVariables,
  TContext
> {
  mutation: (variables: TVariables) => Promise<TData>;
}

export interface AppMutationResult<TData, TVariables, TContext = unknown> {
  readonly data: TData | undefined;
  readonly error: Error | undefined;
  readonly isError: boolean;
  readonly isPending: boolean;
  readonly isSuccess: boolean;
  mutate(variables: TVariables, callbacks?: MutationCallbacks<TData, TVariables, TContext>): void;
  mutateAsync(variables: TVariables): Promise<TData>;
  reset(): void;
}

export const createAppMutation = <TData, TVariables, TContext = unknown>(
  options: CreateAppMutationOptions<TData, TVariables, TContext>,
): AppMutationResult<TData, TVariables, TContext> => {
  const { mutation, ...callbacks } = options;
  const controller = createMutationController(mutation, callbacks);
  return {
    get data() {
      return controller.data();
    },
    get error() {
      return controller.error();
    },
    get isError() {
      return controller.status() === 'error';
    },
    get isPending() {
      return controller.status() === 'pending';
    },
    get isSuccess() {
      return controller.status() === 'success';
    },
    mutate: (variables, perCallCallbacks) => {
      void controller.runWithOptions(variables, perCallCallbacks).catch(() => undefined);
    },
    mutateAsync: (variables) => controller.run(variables),
    reset: () => controller.reset(),
  };
};

export const invalidateQuery = (key: QueryKey, client?: QueryClient): void =>
  (client ?? useQueryClient()).invalidateQueries(key);
