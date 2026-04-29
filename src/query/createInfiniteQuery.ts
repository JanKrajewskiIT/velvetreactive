import { type Accessor, createEffect, createMemo, createSignal, on, onCleanup } from 'solid-js';

import { createAppQuery, type CreateAppQueryOptions } from './createAppSignals';
import { getDefaultQueryClient } from './queryClientContext';
import type { QueryKey } from './types';

export interface InfinitePageResult<TItem, TCursor = unknown> {
  items: TItem[];
  nextCursor?: TCursor;
}

export interface CreateInfiniteQueryOptions<TItem, TCursor = unknown> extends Omit<
  CreateAppQueryOptions<InfinitePageResult<TItem, TCursor>>,
  'key' | 'query'
> {
  key: QueryKey;
  pageSize?: number;
  query: (
    params: { cursor?: TCursor; pageSize: number },
    signal?: AbortSignal,
  ) => Promise<InfinitePageResult<TItem, TCursor>>;
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
  fetchNextPage: () => Promise<void>;
  refetch: () => Promise<void>;
  invalidate: () => void;
}

export const createInfiniteQuery = <TItem, TCursor = unknown>(
  options: CreateInfiniteQueryOptions<TItem, TCursor>,
): InfiniteQueryResult<TItem> => {
  const client = options.client ?? getDefaultQueryClient();
  const pageSize = options.pageSize ?? 20;
  const [pages, setPages] = createSignal<Array<TItem[]>>([]);
  const [nextCursor, setNextCursor] = createSignal<TCursor | undefined>(undefined);
  const [hasNextPage, setHasNextPage] = createSignal(true);
  const [isFetchingNextPage, setIsFetchingNextPage] = createSignal(false);
  const [activeAbort, setActiveAbort] = createSignal<AbortController | undefined>(undefined);

  const firstPage = createAppQuery<InfinitePageResult<TItem, TCursor>>({
    ...options,
    key: options.key,
    query: (signal) => options.query({ cursor: undefined, pageSize }, signal),
  });

  const resetPages = () => {
    activeAbort()?.abort();
    setActiveAbort(undefined);
    setPages([]);
    setNextCursor(undefined);
    setHasNextPage(true);
    setIsFetchingNextPage(false);
  };

  const invalidateAllPages = () => {
    resetPages();
    client.invalidateQueries(options.key);
  };

  const allItems = createMemo(() => {
    const firstItems = firstPage.data?.items ?? [];
    const restPages = pages();
    if (restPages.length === 0) return firstItems;
    return [firstItems, ...restPages].flat();
  });

  const allPages: Accessor<Array<TItem[]>> = createMemo(() => {
    const firstItems = firstPage.data?.items;
    if (!firstItems) return [];
    return [firstItems, ...pages()];
  });

  const resolvedHasNextPage = createMemo(() => {
    if (pages().length === 0) {
      return firstPage.data?.nextCursor !== undefined;
    }
    return hasNextPage();
  });

  const resolvedNextCursor = createMemo(() => {
    if (pages().length === 0) {
      return firstPage.data?.nextCursor;
    }
    return nextCursor();
  });

  const fetchNextPage = async (): Promise<void> => {
    const cursor = resolvedNextCursor();
    if (!resolvedHasNextPage() || cursor === undefined || isFetchingNextPage()) return;

    const pageKey: QueryKey = [...options.key, { cursor, pageSize }];
    const cachedPage = client.getQueryData(pageKey) as InfinitePageResult<TItem, TCursor> | undefined;
    if (cachedPage) {
      setPages((prev) => [...prev, cachedPage.items]);
      setNextCursor(() => cachedPage.nextCursor);
      setHasNextPage(cachedPage.nextCursor !== undefined);
      return;
    }

    const controller = new AbortController();
    activeAbort()?.abort();
    setActiveAbort(controller);
    setIsFetchingNextPage(true);

    try {
      const result = await options.query({ cursor, pageSize }, controller.signal);
      if (controller.signal.aborted) {
        return;
      }

      client.setQueryData(pageKey, result);
      setPages((prev) => [...prev, result.items]);
      setNextCursor(() => result.nextCursor);
      setHasNextPage(result.nextCursor !== undefined);
    } catch (error: unknown) {
      if (controller.signal.aborted) {
        return;
      }

      throw error;
    } finally {
      if (Object.is(activeAbort(), controller)) {
        setActiveAbort(undefined);
      }
      setIsFetchingNextPage(false);
    }
  };

  const refetch = async (): Promise<void> => {
    invalidateAllPages();
    await firstPage.refetch();
  };

  const invalidate = (): void => {
    invalidateAllPages();
  };

  if (options.auth) {
    createEffect(
      on(
        options.auth.accessToken,
        () => {
          invalidateAllPages();
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
          invalidateAllPages();
        },
        { defer: true },
      ),
    );
  }

  onCleanup(() => {
    activeAbort()?.abort();
  });

  return {
    get pages() {
      return allPages();
    },
    get allItems() {
      return allItems();
    },
    get hasNextPage() {
      return resolvedHasNextPage();
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
    refetch,
    invalidate,
  };
};
