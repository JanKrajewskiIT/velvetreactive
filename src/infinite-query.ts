import { type Accessor, createEffect, createSignal, on, onCleanup } from 'solid-js';

import { type AuthStateAdapter, createAppQuery } from './app-query.js';
import type { QueryClient } from './query-client.js';
import { useQueryClient } from './query-context.js';
import type { QueryKey } from './query-key.js';
import type { QueryOptions } from './query-signal.js';

export interface InfinitePageResult<TItem, TCursor = unknown> {
  items: TItem[];
  nextCursor?: TCursor;
}

export interface CreateInfiniteQueryOptions<TItem, TCursor = unknown> extends QueryOptions<
  InfinitePageResult<TItem, TCursor>
> {
  key: QueryKey;
  pageSize?: number;
  client?: QueryClient;
  auth?: AuthStateAdapter;
  watch?: Accessor<unknown>;
  query(
    params: { cursor?: TCursor; pageSize: number },
    signal?: AbortSignal,
  ): Promise<InfinitePageResult<TItem, TCursor>>;
}

export interface InfiniteQueryResult<TItem> {
  readonly pages: Array<TItem[]>;
  readonly allItems: TItem[];
  readonly hasNextPage: boolean;
  readonly isFetchingNextPage: boolean;
  readonly isLoading: boolean;
  readonly isFetching: boolean;
  readonly isError: boolean;
  readonly isSuccess: boolean;
  readonly error: Error | undefined;
  fetchNextPage(): Promise<void>;
  refetch(): Promise<void>;
  invalidate(): void;
}

export const createInfiniteQuery = <TItem, TCursor = unknown>(
  options: CreateInfiniteQueryOptions<TItem, TCursor>,
): InfiniteQueryResult<TItem> => {
  const pageSize = options.pageSize ?? 20;
  const client = options.client ?? useQueryClient();
  const [additionalPages, setAdditionalPages] = createSignal<Array<InfinitePageResult<TItem, TCursor>>>([]);
  const [isFetchingNextPage, setIsFetchingNextPage] = createSignal(false);
  let additionalController: AbortController | undefined;

  const firstPage = createAppQuery<InfinitePageResult<TItem, TCursor>>({
    key: options.key,
    query: (signal) => options.query({ pageSize }, signal),
    client,
    ...(options.auth === undefined ? {} : { auth: options.auth }),
    ...(options.enabled === undefined ? {} : { enabled: options.enabled }),
    ...(options.staleTime === undefined ? {} : { staleTime: options.staleTime }),
    ...(options.retry === undefined ? {} : { retry: options.retry }),
    ...(options.retryDelay === undefined ? {} : { retryDelay: options.retryDelay }),
    ...(options.initialData === undefined ? {} : { initialData: options.initialData }),
  });

  const lastPage = (): InfinitePageResult<TItem, TCursor> | undefined => {
    const pages = additionalPages();
    return pages.length > 0 ? pages[pages.length - 1] : firstPage.data;
  };
  const nextCursor = (): TCursor | undefined => lastPage()?.nextCursor;

  const resetAdditionalPages = (): void => {
    additionalController?.abort();
    additionalController = undefined;
    setAdditionalPages([]);
    setIsFetchingNextPage(false);
  };

  const invalidate = (): void => {
    resetAdditionalPages();
    client.invalidateQueries(options.key);
  };

  if (options.auth !== undefined) {
    createEffect(on(options.auth.accessToken, invalidate, { defer: true }));
  }
  if (options.watch !== undefined) {
    createEffect(on(options.watch, invalidate, { defer: true }));
  }
  onCleanup(() => additionalController?.abort());

  const fetchNextPage = async (): Promise<void> => {
    const cursor = nextCursor();
    if (cursor === undefined || isFetchingNextPage()) return;
    const key = [...options.key, { cursor, pageSize }];
    const cached = client.getQueryData(key) as InfinitePageResult<TItem, TCursor> | undefined;
    if (cached) {
      setAdditionalPages((pages) => [...pages, cached]);
      return;
    }

    const controller = new AbortController();
    additionalController = controller;
    setIsFetchingNextPage(true);
    try {
      const page = await options.query({ cursor, pageSize }, controller.signal);
      if (controller.signal.aborted) return;
      client.setQueryData(key, page);
      setAdditionalPages((pages) => [...pages, page]);
    } catch (error) {
      if (!controller.signal.aborted) {
        throw error instanceof Error ? error : new Error('Query failed');
      }
    } finally {
      if (additionalController === controller) additionalController = undefined;
      if (!controller.signal.aborted) setIsFetchingNextPage(false);
    }
  };

  return {
    get pages() {
      return firstPage.data === undefined ? [] : [firstPage.data.items, ...additionalPages().map((page) => page.items)];
    },
    get allItems() {
      return this.pages.flat();
    },
    get hasNextPage() {
      return nextCursor() !== undefined;
    },
    get isFetchingNextPage() {
      return isFetchingNextPage();
    },
    get isLoading() {
      return firstPage.isLoading;
    },
    get isFetching() {
      return firstPage.isFetching || isFetchingNextPage();
    },
    get isError() {
      return firstPage.isError;
    },
    get isSuccess() {
      return firstPage.isSuccess;
    },
    get error() {
      return firstPage.error;
    },
    fetchNextPage,
    refetch: async () => {
      invalidate();
      await firstPage.refetch();
    },
    invalidate,
  };
};
