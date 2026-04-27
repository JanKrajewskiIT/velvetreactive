import { type Accessor, createMemo, createSignal } from 'solid-js';

import { createAppQuery, type CreateAppQueryOptions } from './createAppSignals';
import type { QueryKey } from './types';

export interface PagedData<TItem> {
  items: TItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
}

export interface CreatePaginatedQueryOptions<TItem> extends Omit<
  CreateAppQueryOptions<PagedData<TItem>>,
  'key' | 'query'
> {
  key: QueryKey;
  pageSize?: number;
  query: (params: { page: number; pageSize: number }, signal?: AbortSignal) => Promise<PagedData<TItem>>;
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
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  nextPage: () => void;
  previousPage: () => void;
  refetch: () => Promise<PagedData<TItem>>;
  invalidate: () => void;
}

export const createPaginatedQuery = <TItem>(
  options: CreatePaginatedQueryOptions<TItem>,
): PaginatedQueryResult<TItem> => {
  const [page, setPage] = createSignal(1);
  const [pageSize, setPageSize] = createSignal(options.pageSize ?? 20);

  const dynamicKey: Accessor<QueryKey> = () => [...options.key, { page: page(), pageSize: pageSize() }];

  const inner = createAppQuery<PagedData<TItem>>({
    ...options,
    key: dynamicKey,
    query: (signal) => options.query({ page: page(), pageSize: pageSize() }, signal),
  });

  const pagedData = createMemo(() => inner.data);

  return {
    get data() {
      return pagedData()?.items;
    },
    get page() {
      return pagedData()?.page ?? page();
    },
    get pageSize() {
      return pagedData()?.pageSize ?? pageSize();
    },
    get totalCount() {
      return pagedData()?.totalCount ?? 0;
    },
    get totalPages() {
      return pagedData()?.totalPages ?? 0;
    },
    get hasNextPage() {
      return pagedData()?.hasNextPage ?? false;
    },
    get hasPreviousPage() {
      return page() > 1;
    },
    get isLoading() {
      return inner.isLoading;
    },
    get isFetching() {
      return inner.isFetching;
    },
    get isError() {
      return inner.isError;
    },
    get isSuccess() {
      return inner.isSuccess;
    },
    get error() {
      return inner.error;
    },
    setPage(nextPage: number) {
      if (nextPage >= 1) {
        setPage(nextPage);
      }
    },
    setPageSize(size: number) {
      setPageSize(size);
      setPage(1);
    },
    nextPage() {
      if (pagedData()?.hasNextPage) {
        setPage((current) => current + 1);
      }
    },
    previousPage() {
      if (page() > 1) {
        setPage((current) => current - 1);
      }
    },
    refetch: inner.refetch,
    invalidate: inner.invalidate,
  };
};
