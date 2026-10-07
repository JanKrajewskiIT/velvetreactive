import { batch, createMemo, createSignal, mergeProps, onCleanup, untrack } from 'solid-js';

import { toError } from '../shared/toError.js';
import type { CreateAppQueryOptions } from './appQuery.js';
import { createGatedQuerySignal, watchRevalidationTriggers } from './appQueryCore.js';
import { DEFAULT_PAGE_SIZE } from './pageSize.js';
import { useQueryClient } from './queryContext.js';
import type { QuerySource } from './querySignal.js';
import type { QueryStatusFlags } from './queryStatusFlags.js';
import { createQueryStatusFlags } from './queryStatusFlags.js';
import type { QueryKey } from './queryTypes.js';

export interface InfinitePageResult<TItem, TCursor = unknown> {
  items: TItem[];
  nextCursor?: TCursor;
}

export interface CreateInfiniteQueryOptions<TItem, TCursor = unknown> extends Omit<
  CreateAppQueryOptions<InfinitePageResult<TItem, TCursor>>,
  'key' | 'query' | 'select'
> {
  key: QueryKey;
  pageSize?: number;
  query: (
    params: { cursor?: TCursor; pageSize: number },
    signal?: AbortSignal,
  ) => Promise<InfinitePageResult<TItem, TCursor>>;
}

export interface InfiniteQueryResult<TItem> extends QueryStatusFlags {
  readonly pages: Array<TItem[]>;
  readonly allItems: TItem[];
  readonly hasNextPage: boolean;
  readonly isFetchingNextPage: boolean;
  fetchNextPage: () => Promise<void>;
  refetch: () => Promise<void>;
  invalidate: () => void;
}

interface AdditionalPages<TItem, TCursor> {
  readonly pages: readonly TItem[][];
  readonly nextCursor: TCursor | undefined;
}

const createEmptyAdditionalPages = <TItem, TCursor>(): AdditionalPages<TItem, TCursor> => ({
  pages: [],
  nextCursor: undefined,
});

export const createInfiniteQuery = <TItem, TCursor = unknown>({
  key,
  pageSize = DEFAULT_PAGE_SIZE,
  query,
  ...queryOptions
}: CreateInfiniteQueryOptions<TItem, TCursor>): InfiniteQueryResult<TItem> => {
  const client = queryOptions.client ?? useQueryClient();
  const firstPageSource: QuerySource<InfinitePageResult<TItem, TCursor>> = {
    key,
    load: (signal) => query({ pageSize }, signal),
  };
  const firstPage = createGatedQuerySignal({ ...queryOptions, client, source: () => firstPageSource });

  const [additionalPages, setAdditionalPages] = createSignal(createEmptyAdditionalPages<TItem, TCursor>());
  const [isFetchingNextPage, setFetchingNextPage] = createSignal(false);
  let nextPageController: AbortController | undefined;
  let generation = 0;

  const pages = createMemo(() => {
    const first = firstPage.data();
    return first === undefined ? [] : [first.items, ...additionalPages().pages];
  });
  const allItems = createMemo(() => pages().flatMap((page) => page));
  const nextCursor = createMemo(() => {
    const loaded = additionalPages();
    return loaded.pages.length === 0 ? firstPage.data()?.nextCursor : loaded.nextCursor;
  });

  const appendPage = (page: InfinitePageResult<TItem, TCursor>): void => {
    setAdditionalPages((current) => ({ pages: [...current.pages, page.items], nextCursor: page.nextCursor }));
  };

  const resetAdditionalPages = (): void => {
    generation += 1;
    nextPageController?.abort();
    nextPageController = undefined;
    batch(() => {
      setAdditionalPages(createEmptyAdditionalPages<TItem, TCursor>());
      setFetchingNextPage(false);
    });
  };

  const invalidate = (): void => {
    resetAdditionalPages();
    client.invalidateQueries(key);
  };

  const fetchNextPage = async (): Promise<void> => {
    const cursor = untrack(nextCursor);
    if (cursor === undefined || untrack(isFetchingNextPage)) {
      return;
    }
    const pageKey = [...key, { cursor, pageSize }];
    const cached = untrack(client.ensureQuery<InfinitePageResult<TItem, TCursor>>(pageKey).state);
    if (cached.data !== undefined && cached.updatedAt !== undefined) {
      appendPage(cached.data);
      return;
    }

    const requestGeneration = generation;
    const controller = new AbortController();
    nextPageController = controller;
    setFetchingNextPage(true);
    try {
      const page = await query({ cursor, pageSize }, controller.signal);
      if (controller.signal.aborted || requestGeneration !== generation) {
        return;
      }
      client.setQueryData(pageKey, page);
      appendPage(page);
    } catch (thrown) {
      if (controller.signal.aborted) {
        return;
      }
      throw toError(thrown, 'Failed to load the next page');
    } finally {
      if (nextPageController === controller) {
        nextPageController = undefined;
        setFetchingNextPage(false);
      }
    }
  };

  const refetch = async (): Promise<void> => {
    invalidate();
    await firstPage.refetch();
  };

  watchRevalidationTriggers(queryOptions.auth, queryOptions.watch, invalidate);
  onCleanup(() => {
    nextPageController?.abort();
  });

  return mergeProps(
    createQueryStatusFlags({
      status: firstPage.status,
      error: firstPage.error,
      isFetching: () => firstPage.isFetching() || isFetchingNextPage(),
    }),
    {
      get pages() {
        return pages();
      },
      get allItems() {
        return allItems();
      },
      get hasNextPage() {
        return nextCursor() !== undefined;
      },
      get isFetchingNextPage() {
        return isFetchingNextPage();
      },
      fetchNextPage,
      refetch,
      invalidate,
    },
  );
};
