import type { Accessor } from 'solid-js';

export type QueryKeyPart = unknown;
export type QueryKey = readonly QueryKeyPart[];

export type QueryStatus = 'idle' | 'loading' | 'success' | 'error';
export type MutationStatus = 'idle' | 'pending' | 'success' | 'error';
export type QueryRetry = number | ((attempt: number, error: Error) => boolean);
export type QueryRetryDelay = number | ((attempt: number) => number);

export interface QueryState<TData> {
  status: QueryStatus;
  data: TData | undefined;
  error: Error | undefined;
  updatedAt: number | undefined;
  isFetching: boolean;
}

export interface MutationState<TData> {
  status: MutationStatus;
  data: TData | undefined;
  error: Error | undefined;
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

export interface MutationSignal<TData, TVariables> {
  status: Accessor<MutationStatus>;
  data: Accessor<TData | undefined>;
  error: Accessor<Error | undefined>;
  run: (variables: TVariables) => Promise<TData>;
  reset: () => void;
}

export interface QueryOptions<TData> {
  staleTime?: number;
  retry?: QueryRetry;
  retryDelay?: QueryRetryDelay;
  enabled?: Accessor<boolean>;
  initialData?: TData;
}

export type QueryKeyInput = QueryKey | Accessor<QueryKey>;

export interface QueryDefaults {
  staleTime: number;
  retry: QueryRetry;
  retryDelay: QueryRetryDelay;
  gcTime: number;
}

export interface CreateQueryClientOptions {
  defaultOptions?: {
    queries?: Partial<QueryDefaults>;
  };
}

export interface MutationOptions<TData, TVariables, TContext = unknown> {
  onMutate?: (variables: TVariables) => TContext | Promise<TContext>;
  onSuccess?: (result: TData, variables: TVariables, context?: TContext) => void;
  onError?: (error: Error, variables: TVariables, context?: TContext) => void;
  onSettled?: (data: TData | undefined, error: Error | undefined, variables: TVariables, context?: TContext) => void;
}
