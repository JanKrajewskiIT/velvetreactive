import { batch, createSignal, mergeProps, untrack } from 'solid-js';

import type { CreateAppQueryOptions } from './appQuery.js';
import { createSourcedAppQuery } from './appQueryCore.js';
import { DEFAULT_PAGE_SIZE } from './pageSize.js';
import type { QuerySource } from './querySignal.js';
import type { QueryStatusFlags } from './queryStatusFlags.js';
import { createQueryStatusFlags } from './queryStatusFlags.js';
import type { QueryKey } from './queryTypes.js';

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
  'key' | 'query' | 'select'
> {
  key: QueryKey;
  pageSize?: number;
  query: (params: { page: number; pageSize: number }, signal?: AbortSignal) => Promise<PagedData<TItem>>;
}

export interface PaginatedQueryResult<TItem> extends QueryStatusFlags {
  readonly data: TItem[] | undefined;
  readonly page: number;
  readonly pageSize: number;
  readonly totalCount: number;
  readonly totalPages: number;
  readonly hasNextPage: boolean;
  readonly hasPreviousPage: boolean;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  nextPage: () => void;
  previousPage: () => void;
  refetch: () => Promise<PagedData<TItem>>;
  invalidate: () => void;
}

const assertPositiveInteger = (value: number, label: string): void => {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive integer.`);
  }
};

export const createPaginatedQuery = <TItem>({
  key,
  pageSize: initialPageSize = DEFAULT_PAGE_SIZE,
  query,
  ...appQueryOptions
}: CreatePaginatedQueryOptions<TItem>): PaginatedQueryResult<TItem> => {
  assertPositiveInteger(initialPageSize, 'pageSize');
  const [page, setPageValue] = createSignal(1);
  const [pageSize, setPageSizeValue] = createSignal(initialPageSize);

  const source = (): QuerySource<PagedData<TItem>> => {
    const staticParams = { page: page(), pageSize: pageSize() };
    return { key: [...key, staticParams], load: (signal) => query(staticParams, signal) };
  };
  const pagedQuery = createSourcedAppQuery<PagedData<TItem>>({ ...appQueryOptions, source });

  return mergeProps(createQueryStatusFlags(pagedQuery), {
    get data() {
      return pagedQuery.data()?.items;
    },
    get page() {
      return pagedQuery.data()?.page ?? page();
    },
    get pageSize() {
      return pagedQuery.data()?.pageSize ?? pageSize();
    },
    get totalCount() {
      return pagedQuery.data()?.totalCount ?? 0;
    },
    get totalPages() {
      return pagedQuery.data()?.totalPages ?? 0;
    },
    get hasNextPage() {
      return pagedQuery.data()?.hasNextPage ?? false;
    },
    get hasPreviousPage() {
      return page() > 1;
    },
    setPage: (nextPage: number) => {
      assertPositiveInteger(nextPage, 'page');
      setPageValue(nextPage);
    },
    setPageSize: (size: number) => {
      assertPositiveInteger(size, 'pageSize');
      batch(() => {
        setPageSizeValue(size);
        setPageValue(1);
      });
    },
    nextPage: () => {
      if (untrack(pagedQuery.data)?.hasNextPage === true) {
        setPageValue((current) => current + 1);
      }
    },
    previousPage: () => {
      setPageValue((current) => Math.max(current - 1, 1));
    },
    refetch: pagedQuery.refetch,
    invalidate: pagedQuery.invalidate,
  });
};
