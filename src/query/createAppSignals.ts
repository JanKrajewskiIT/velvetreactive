import { type Accessor, createEffect, createMemo, on } from 'solid-js';

import { createMutationSignal } from './createMutationSignal';
import type { QueryClient } from './createQueryClient';
import { createQuerySignal, type CreateQuerySignalOptions } from './createQuerySignal';
import { getDefaultQueryClient } from './queryClientContext';
import type { QueryKey } from './types';

interface MutationCallbacks<TData, TVariables, TContext = unknown> {
  onMutate?: (variables: TVariables) => TContext | Promise<TContext>;
  onError?: (error: Error, variables: TVariables, context?: TContext) => void;
  onSuccess?: (data: TData, variables: TVariables, context?: TContext) => void;
  onSettled?: (data: TData | undefined, error: Error | undefined, variables: TVariables, context?: TContext) => void;
}

interface AppMutationResult<TData, TVariables, TContext = unknown> {
  readonly data: TData | undefined;
  readonly error: Error | undefined;
  readonly isError: boolean;
  readonly isPending: boolean;
  readonly isSuccess: boolean;
  mutate: (variables: TVariables, callbacks?: MutationCallbacks<TData, TVariables, TContext>) => void;
  mutateAsync: (variables: TVariables) => Promise<TData>;
  reset: () => void;
}

interface AppQueryResult<TData> {
  readonly data: TData | undefined;
  readonly error: Error | undefined;
  readonly isError: boolean;
  readonly isFetching: boolean;
  readonly isLoading: boolean;
  readonly isSuccess: boolean;
  invalidate: () => void;
  refetch: () => Promise<TData>;
}

/**
 * Minimal authentication adapter consumed by `createAppQuery`. Any auth
 * provider can satisfy this contract by exposing reactive accessors for
 * `isAuthenticated`, the current user reference, and the access token. When
 * provided, queries automatically wait for an authenticated session and are
 * re-invalidated whenever the access token changes.
 */
interface AuthStateAdapter {
  isAuthenticated: Accessor<boolean>;
  user: Accessor<unknown>;
  accessToken: Accessor<string | undefined>;
}

interface CreateAppQueryOptions<TData> extends Omit<CreateQuerySignalOptions<TData>, 'client'> {
  client?: QueryClient;
  auth?: AuthStateAdapter;
  watch?: Accessor<unknown>;
  select?: (data: TData) => unknown;
}

function createAppQuery<TData>(options: CreateAppQueryOptions<TData>): AppQueryResult<TData>;
function createAppQuery<TData, TSelected>(
  options: CreateAppQueryOptions<TData> & { select: (data: TData) => TSelected },
): AppQueryResult<TSelected>;
function createAppQuery<TData>(options: CreateAppQueryOptions<TData>): AppQueryResult<unknown> {
  const auth = options.auth;
  const client = options.client ?? getDefaultQueryClient();

  const enabled = () => {
    const isEnabled = options.enabled?.() ?? true;
    if (!auth) {
      return isEnabled;
    }

    return isEnabled && (auth.isAuthenticated() || auth.user() !== null || auth.accessToken() !== undefined);
  };

  const signal = createQuerySignal({
    ...options,
    enabled,
    client,
  });

  if (auth) {
    createEffect(
      on(
        auth.accessToken,
        () => {
          signal.invalidate();
        },
        { defer: true },
      ),
    );
  }

  if (options.watch) {
    createEffect(
      on(
        options.watch,
        () => {
          signal.invalidate();
        },
        { defer: true },
      ),
    );
  }

  const selectFn = options.select;
  const selectedData = createMemo(() => {
    const raw = signal.data();
    if (selectFn && raw !== undefined) return selectFn(raw);
    return raw;
  });

  return {
    get data() {
      return selectedData();
    },
    get error() {
      return signal.error();
    },
    get isError() {
      return signal.status() === 'error';
    },
    get isFetching() {
      return signal.isFetching();
    },
    get isLoading() {
      return signal.status() === 'loading';
    },
    get isSuccess() {
      return signal.status() === 'success';
    },
    invalidate: signal.invalidate,
    refetch: signal.refetch,
  };
}

const createAppMutation = <TData, TVariables, TContext = unknown>(
  mutate: (variables: TVariables) => Promise<TData>,
  callbacks?: MutationCallbacks<TData, TVariables, TContext>,
): AppMutationResult<TData, TVariables, TContext> => {
  const signal = createMutationSignal<TData, TVariables, TContext>(mutate, callbacks);

  return {
    get data() {
      return signal.data();
    },
    get error() {
      return signal.error();
    },
    get isError() {
      return signal.status() === 'error';
    },
    get isPending() {
      return signal.status() === 'pending';
    },
    get isSuccess() {
      return signal.status() === 'success';
    },
    mutate(variables, localCallbacks) {
      void signal
        .run(variables)
        .then((result) => {
          localCallbacks?.onSuccess?.(result, variables);
        })
        .catch((error: unknown) => {
          localCallbacks?.onError?.(error instanceof Error ? error : new Error('Mutation failed'), variables);
        });
    },
    mutateAsync: signal.run,
    reset: signal.reset,
  };
};

const invalidateQuery = (queryKey: QueryKey, client?: QueryClient): void => {
  (client ?? getDefaultQueryClient()).invalidateQueries(queryKey);
};

export type { AppMutationResult, AppQueryResult, AuthStateAdapter, CreateAppQueryOptions, MutationCallbacks };
export { createAppMutation, createAppQuery, invalidateQuery };
