import { batch, createSignal } from 'solid-js';

import { type AuthStateAdapter, createAppQuery } from './app-query.js';
import type { QueryClient } from './query-client.js';
import type { QueryKey } from './query-key.js';
import type { QueryOptions } from './query-signal.js';

export interface PagedData<TItem> {
  items: TItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
}

export interface CreatePaginatedQueryOptions<TItem> extends QueryOptions<PagedData<TItem>> {
  key: QueryKey;
  pageSize?: number;
  client?: QueryClient;
  auth?: AuthStateAdapter;
  watch?: () => unknown;
  query(params: { page: number; pageSize: number }, signal?: AbortSignal): Promise<PagedData<TItem>>;
}

export interface PaginatedQueryResult<TItem> {
  readonly data: TItem[] | undefined;
  readonly page: number;
  readonly pageSize: number;
  readonly totalCount: number;
  readonly totalPages: number;
  readonly hasNextPage: boolean;
  readonly hasPreviousPage: boolean;
  readonly isLoading: boolean;
  readonly isFetching: boolean;
  readonly isError: boolean;
  readonly isSuccess: boolean;
  readonly error: Error | undefined;
  setPage(page: number): void;
  setPageSize(size: number): void;
  nextPage(): void;
  previousPage(): void;
  refetch(): Promise<PagedData<TItem>>;
  invalidate(): void;
}

const requirePositiveInteger = (value: number, name: string): void => {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive finite integer`);
  }
};

export const createPaginatedQuery = <TItem>(
  options: CreatePaginatedQueryOptions<TItem>,
): PaginatedQueryResult<TItem> => {
  const initialPageSize = options.pageSize ?? 20;
  requirePositiveInteger(initialPageSize, 'pageSize');
  const [page, setPageValue] = createSignal(1);
  const [pageSize, setPageSizeValue] = createSignal(initialPageSize);
  const query = createAppQuery<PagedData<TItem>>({
    key: () => [...options.key, { page: page(), pageSize: pageSize() }],
    query: (signal) => options.query({ page: page(), pageSize: pageSize() }, signal),
    ...(options.client === undefined ? {} : { client: options.client }),
    ...(options.auth === undefined ? {} : { auth: options.auth }),
    ...(options.watch === undefined ? {} : { watch: options.watch }),
    ...(options.enabled === undefined ? {} : { enabled: options.enabled }),
    ...(options.staleTime === undefined ? {} : { staleTime: options.staleTime }),
    ...(options.retry === undefined ? {} : { retry: options.retry }),
    ...(options.retryDelay === undefined ? {} : { retryDelay: options.retryDelay }),
    ...(options.initialData === undefined ? {} : { initialData: options.initialData }),
  });

  return {
    get data() {
      return query.data?.items;
    },
    get page() {
      return query.data?.page ?? page();
    },
    get pageSize() {
      return query.data?.pageSize ?? pageSize();
    },
    get totalCount() {
      return query.data?.totalCount ?? 0;
    },
    get totalPages() {
      return query.data?.totalPages ?? 0;
    },
    get hasNextPage() {
      return query.data?.hasNextPage ?? false;
    },
    get hasPreviousPage() {
      return page() > 1;
    },
    get isLoading() {
      return query.isLoading;
    },
    get isFetching() {
      return query.isFetching;
    },
    get isError() {
      return query.isError;
    },
    get isSuccess() {
      return query.isSuccess;
    },
    get error() {
      return query.error;
    },
    setPage: (nextPage) => {
      requirePositiveInteger(nextPage, 'page');
      setPageValue(nextPage);
    },
    setPageSize: (nextPageSize) => {
      requirePositiveInteger(nextPageSize, 'pageSize');
      batch(() => {
        setPageSizeValue(nextPageSize);
        setPageValue(1);
      });
    },
    nextPage: () => {
      if (query.data?.hasNextPage) setPageValue((current) => current + 1);
    },
    previousPage: () => setPageValue((current) => Math.max(1, current - 1)),
    refetch: () => query.refetch(),
    invalidate: () => query.invalidate(),
  };
};
