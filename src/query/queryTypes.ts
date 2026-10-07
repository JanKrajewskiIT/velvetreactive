import type { Accessor } from 'solid-js';

export type QueryKeyPart = unknown;
export type QueryKey = readonly QueryKeyPart[];
export type QueryKeyInput = QueryKey | Accessor<QueryKey>;
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

export interface QueryOptions<TData> {
  staleTime?: number;
  retry?: QueryRetry;
  retryDelay?: QueryRetryDelay;
  enabled?: Accessor<boolean>;
  initialData?: TData;
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

export type QueryStateUpdater<TData> = QueryState<TData> | ((previous: QueryState<TData>) => QueryState<TData>);

export interface QueryEntryHandle<TData> {
  readonly state: Accessor<QueryState<TData>>;
  readonly setState: (next: QueryStateUpdater<TData>) => void;
  readonly inFlight: Promise<TData> | null;
  readonly invalidate: () => void;
}

export interface QueryClient {
  readonly ensureQuery: <TData>(key: QueryKey) => QueryEntryHandle<TData>;
  readonly getQueryData: (key: QueryKey) => unknown;
  readonly setQueryData: <TData>(key: QueryKey, updater: TData | ((previous: TData | undefined) => TData)) => void;
  readonly invalidateQueries: (partialKey?: QueryKey) => void;
  readonly removeQueries: (partialKey?: QueryKey) => void;
  readonly dispose: () => void;
  readonly defaults: Readonly<QueryDefaults>;
}
