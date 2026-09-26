import { createInfiniteQuery, createPaginatedQuery } from '../src/index.js';

createPaginatedQuery<number>({
  key: ['items'],
  query: () =>
    Promise.resolve({
      items: [],
      totalCount: 0,
      page: 1,
      pageSize: 20,
      totalPages: 0,
      hasNextPage: false,
    }),
  // @ts-expect-error Paginated queries expose their complete page envelope.
  select: (data: unknown) => data,
});

createInfiniteQuery<number>({
  key: ['items'],
  query: () => Promise.resolve({ items: [] }),
  // @ts-expect-error Infinite queries expose their complete page envelope.
  select: (data: unknown) => data,
});
