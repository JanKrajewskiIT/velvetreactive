# Task 03: Query And Mutation Primitives

## Purpose

Provide a SolidJS-native in-memory query cache, reactive reads and mutations, application wrappers, CRUD composition, pagination, infinite loading, context, and rendering boundaries.

## Public Type Surface

```ts
type QueryKeyPart = unknown;
type QueryKey = readonly QueryKeyPart[];
type QueryKeyInput = QueryKey | Accessor<QueryKey>;
type QueryStatus = 'idle' | 'loading' | 'success' | 'error';
type MutationStatus = 'idle' | 'pending' | 'success' | 'error';
type QueryRetry = number | ((attempt: number, error: Error) => boolean);
type QueryRetryDelay = number | ((attempt: number) => number);

interface QueryState<TData> {
  status: QueryStatus;
  data: TData | undefined;
  error: Error | undefined;
  updatedAt: number | undefined;
  isFetching: boolean;
}

interface MutationState<TData> {
  status: MutationStatus;
  data: TData | undefined;
  error: Error | undefined;
}

interface QueryOptions<TData> {
  staleTime?: number;
  retry?: QueryRetry;
  retryDelay?: QueryRetryDelay;
  enabled?: Accessor<boolean>;
  initialData?: TData;
}

interface QueryDefaults {
  staleTime: number;
  retry: QueryRetry;
  retryDelay: QueryRetryDelay;
  gcTime: number;
}

interface CreateQueryClientOptions {
  defaultOptions?: { queries?: Partial<QueryDefaults> };
}
```

The package root also exports all interfaces named in the sections below and these values: `createQueryClient`, `createQuerySignal`, `createMutationSignal`, `createAppQuery`, `createAppMutation`, `invalidateQuery`, `createCrudSignals`, `createPaginatedQuery`, `createInfiniteQuery`, `normalizeQueryKey`, `hashQueryKey`, `matchesPartialKey`, `QueryClientContext`, `getDefaultQueryClient`, `useQueryClient`, `QueryClientProvider`, and `QueryBoundary`.

## Query Keys

| ID      | Requirement                                                                                                                                                                                                                        | Provenance    |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| KEY-001 | Normalize every value to a tagged tuple: `['null']`, `['undefined']`, `['string', value]`, `['boolean', value]`, `['number', value]` for finite values, or `['number', 'NaN'\|'Infinity'\|'-Infinity'\|'-0']` for special numbers. | USER: DEC-002 |
| KEY-002 | Normalize arrays as `['array', ...children]`. Normalize plain objects as `['object', [key, child], ...]` with own enumerable string keys sorted lexicographically. Preserve array order.                                           | USER: DEC-002 |
| KEY-003 | Reject cycles, symbols, bigints, functions, and non-plain object prototypes with `TypeError`. Repeated non-cyclic references are allowed and normalized by value.                                                                  | USER: DEC-002 |
| KEY-004 | `hashQueryKey` is JSON serialization of the normalized key. `matchesPartialKey(full, partial)` remains ordered prefix matching over normalized top-level parts; an empty partial key matches every key.                            | USER: DEC-002 |

## Query Client

```ts
interface QueryClient {
  ensureQuery<TData>(key: QueryKey): {
    state: Accessor<QueryState<TData>>;
    setState(next: QueryState<TData> | ((previous: QueryState<TData>) => QueryState<TData>)): void;
    inFlight: Promise<TData> | null;
    invalidate(): void;
  };
  getQueryData(key: QueryKey): unknown;
  setQueryData<TData>(key: QueryKey, updater: TData | ((previous: TData | undefined) => TData)): void;
  invalidateQueries(partialKey?: QueryKey): void;
  removeQueries(partialKey?: QueryKey): void;
  dispose(): void;
  defaults: QueryDefaults;
}
```

The structural return from `ensureQuery` has no separately importable type at the package root.

| ID        | Requirement                                                                                                                                                                                                                                                                                        | Provenance    |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| CACHE-001 | Default query values are `staleTime: 0`, `retry: 0`, `gcTime: 300000`, and retry delay `min(1000 * 2^(attempt - 1), 30000)`. Merge supplied query defaults shallowly over them.                                                                                                                    | SOURCE        |
| CACHE-002 | Cache entries are keyed by `hashQueryKey`. A new entry starts idle with no data, error, update time, or in-flight promise and with `isFetching: false`.                                                                                                                                            | SOURCE        |
| CACHE-003 | `ensureQuery` returns the existing entry for an equal hash or creates one. `ensureQuery` and successful `getQueryData` refresh the entry's last-access time; plain state reads and invalidation do not.                                                                                            | SOURCE        |
| CACHE-004 | `setQueryData` creates a missing entry, resolves a direct value or updater against current data, and sets success, that data, no error, current epoch milliseconds, and not fetching.                                                                                                              | SOURCE        |
| CACHE-005 | `invalidateQueries()` clears `updatedAt` for all entries. With a key, it clears only prefix matches. It retains data, error, status, and in-flight work.                                                                                                                                           | SOURCE        |
| CACHE-006 | `removeQueries()` deletes all entries. With a key, it deletes only prefix matches. It does not abort work held by deleted entries.                                                                                                                                                                 | SOURCE        |
| CACHE-007 | When `gcTime > 0`, begin periodic collection after the first entry. Sweep every `max(gcTime / 2, 30000)` ms and remove entries whose last access is strictly older than `gcTime`, except entries with an in-flight promise or loading status. Stop the interval after a sweep sees an empty cache. | SOURCE        |
| CACHE-008 | When `gcTime <= 0`, do not schedule collection. `dispose` is idempotent, aborts active client-owned queries, clears cache and GC timer, and marks the client disposed. Every later method except `dispose` throws `Error('QueryClient has been disposed')`.                                        | USER: DEC-003 |

## Query Signal

```ts
interface CreateQuerySignalOptions<TData> extends QueryOptions<TData> {
  key: QueryKeyInput;
  query: (signal?: AbortSignal) => Promise<TData>;
  client?: QueryClient;
}

interface QuerySignal<TData> {
  status: Accessor<QueryStatus>;
  data: Accessor<TData | undefined>;
  error: Accessor<Error | undefined>;
  updatedAt: Accessor<number | undefined>;
  isFetching: Accessor<boolean>;
  isStale: Accessor<boolean>;
  refetch(): Promise<TData>;
  invalidate(): void;
  setData(updater: TData | ((previous: TData | undefined) => TData)): void;
}
```

### Selection And Initialization

| ID        | Requirement                                                                                                                                                                                                                                      | Provenance    |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- |
| QUERY-001 | Use the supplied client or the current context/default client. Resolve options once except reactive `key` and `enabled` accessors.                                                                                                               | SOURCE        |
| QUERY-002 | All returned accessors follow the entry for the currently resolved key. A key change selects or creates that key's independent cached state.                                                                                                     | SOURCE        |
| QUERY-003 | If `initialData !== undefined` and the selected entry is idle, set success with initial data, no error, no update timestamp, and not fetching. Repeat this rule for a newly selected key. Initial data is therefore stale.                       | SOURCE        |
| QUERY-004 | `isStale` is true when `updatedAt` is absent, `staleTime <= 0`, or elapsed wall-clock time is strictly greater than `staleTime`. For positive values, an owned timer makes the freshness-to-stale transition reactive at the remaining deadline. | USER: DEC-004 |

### Fetch State Machine

| Event                         | Resulting state and promise behavior                                                                                    |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| First fetch from idle         | status `loading`, existing data retained, error cleared, `isFetching: true`                                             |
| Refetch from success or error | status preserved during fetch, existing data retained, error cleared, `isFetching: true`                                |
| Success                       | status `success`, result data, no error, current epoch update time, `isFetching: false`; resolve result                 |
| Non-abort failure             | status `error`, previous data and update time retained, normalized error, `isFetching: false`; reject error             |
| Abort                         | reject with the thrown `Error`, or `Error('Query aborted')` for a non-Error; legacy state cleanup is subject to DEC-005 |

| ID        | Requirement                                                                                                                                                                                                                                                                                                               | Provenance             |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| QUERY-005 | One in-flight promise exists per cache entry. Concurrent `refetch` calls for the same key return that exact promise and do not start another query.                                                                                                                                                                       | SOURCE                 |
| QUERY-006 | A new fetch owns an AbortController and passes its signal to every retry attempt.                                                                                                                                                                                                                                         | SOURCE                 |
| QUERY-007 | Attempt numbering starts at 1. Numeric retry `N` permits another attempt while `attempt <= N`, producing at most `N + 1` total attempts. A function receives the failed attempt number and normalized error.                                                                                                              | SOURCE                 |
| QUERY-008 | A retry delay number is constant; a function receives the failed attempt number. Positive delays are abortable. Zero or negative delays retry immediately.                                                                                                                                                                | SOURCE                 |
| QUERY-009 | Query failures that are not `Error` become `Error('Query failed')`. Aborts do not retry.                                                                                                                                                                                                                                  | SOURCE                 |
| QUERY-010 | When enabled and stale, initial creation and reactive key/enabled/staleness changes trigger an internally observed refetch. Every explicit invalidation triggers one enabled-observer refetch even when stale was already true. Success at `staleTime <= 0` does not loop. Disabled state prevents a new automatic fetch. | USER: DEC-004, DEC-005 |
| QUERY-011 | The cache request tracks observers. Scope cleanup detaches its observer and aborts shared work only when none remain. Every abort clears fetching state; idle state is restored when no data exists, while existing usable state/data is retained.                                                                        | USER: DEC-005          |
| QUERY-012 | `invalidate` clears only the current entry's update time. `setData` delegates to the client's `setQueryData` for the current key.                                                                                                                                                                                         | SOURCE                 |
| QUERY-013 | Multiple signal instances sharing a key share state and the in-flight promise. Cancellation ownership and abort-state cleanup follow DEC-005.                                                                                                                                                                             | SOURCE                 |

## Mutation Signal

```ts
interface MutationOptions<TData, TVariables, TContext = unknown> {
  onMutate?: (variables: TVariables) => TContext | Promise<TContext>;
  onSuccess?: (result: TData, variables: TVariables, context?: TContext) => void;
  onError?: (error: Error, variables: TVariables, context?: TContext) => void;
  onSettled?: (data: TData | undefined, error: Error | undefined, variables: TVariables, context?: TContext) => void;
}

interface MutationSignal<TData, TVariables> {
  status: Accessor<MutationStatus>;
  data: Accessor<TData | undefined>;
  error: Accessor<Error | undefined>;
  run(variables: TVariables): Promise<TData>;
  reset(): void;
}
```

| ID      | Requirement                                                                                                                                                                                                                                                                                                                                                        | Provenance    |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- |
| MUT-001 | Initial state is idle with no data or error. Await `onMutate` before setting pending and pass its returned context to lifecycle callbacks.                                                                                                                                                                                                                         | SOURCE        |
| MUT-002 | If `onMutate` fails, normalize non-Errors to `Error('onMutate failed')`, set error status while retaining previous data, reject, and do not invoke the mutation, `onError`, or `onSettled`.                                                                                                                                                                        | SOURCE        |
| MUT-003 | Pending retains previous data and clears error. Mutation success replaces state with success/result/no error before invoking `onSuccess`, then `onSettled(result, undefined, ...)`.                                                                                                                                                                                | SOURCE        |
| MUT-004 | Mutation failure normalizes non-Errors to `Error('Mutation failed')`, sets error while retaining previous data, invokes `onError`, then `onSettled(undefined, error, ...)`, and rejects.                                                                                                                                                                           | SOURCE        |
| MUT-005 | Lifecycle callbacks other than `onMutate` are synchronous and not awaited. Invoke all outcome callbacks in registration order, then every settled callback exactly once even if one throws. On operation success, retain success state and reject with the first callback error. On operation failure, retain error state and reject the original operation error. | USER: DEC-006 |
| MUT-006 | `reset` immediately restores the initial state but does not cancel or suppress any running mutation. A later completion may overwrite the reset state.                                                                                                                                                                                                             | SOURCE        |
| MUT-007 | Concurrent runs are allowed and share one state container. Each completion updates it; no call identity, cancellation, or latest-call protection exists.                                                                                                                                                                                                           | SOURCE        |

## Application Wrappers

```ts
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

interface AppQueryResult<TData> {
  readonly data: TData | undefined;
  readonly error: Error | undefined;
  readonly isError: boolean;
  readonly isFetching: boolean;
  readonly isLoading: boolean;
  readonly isSuccess: boolean;
  invalidate(): void;
  refetch(): Promise<TData>;
}

declare function createAppQuery<TData>(options: CreateAppQueryOptions<TData>): AppQueryResult<TData>;
declare function createAppQuery<TData, TSelected>(
  options: CreateAppQueryOptions<TData> & { select: (data: TData) => TSelected },
): AppQueryResult<TSelected>;

interface MutationCallbacks<TData, TVariables, TContext = unknown> extends MutationOptions<
  TData,
  TVariables,
  TContext
> {}

interface AppMutationResult<TData, TVariables, TContext = unknown> {
  readonly data: TData | undefined;
  readonly error: Error | undefined;
  readonly isError: boolean;
  readonly isPending: boolean;
  readonly isSuccess: boolean;
  mutate(variables: TVariables, callbacks?: MutationCallbacks<TData, TVariables, TContext>): void;
  mutateAsync(variables: TVariables): Promise<TData>;
  reset(): void;
}
```

| ID       | Requirement                                                                                                                                                                                                                                                                                                            | Provenance |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| APPQ-001 | An app query is enabled only when its own enabled accessor permits and auth is ready. Auth is ready without an adapter, or when authenticated, access token is not `undefined`, or user is neither `null` nor `undefined`. Empty token strings and falsey non-null users count as specified by those exact predicates. | SOURCE     |
| APPQ-002 | After initial setup, an access-token change invalidates the query. A supplied `watch` accessor likewise invalidates after its first change.                                                                                                                                                                            | SOURCE     |
| APPQ-003 | If `select` exists, apply it reactively only to defined raw data. The overload returns `AppQueryResult<TSelected>`; without it, return `AppQueryResult<TData>`.                                                                                                                                                        | SOURCE     |
| APPQ-004 | Loading means query status `loading`, not every background fetch. Success and error are exact status comparisons.                                                                                                                                                                                                      | SOURCE     |
| APPQ-005 | `invalidateQuery(key, client?)` invalidates matching entries on the supplied client or the default client.                                                                                                                                                                                                             | SOURCE     |

| ID       | Requirement                                                                                                                                                                                                                                          | Provenance             |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| APPM-001 | Creation-time callbacks use the complete mutation lifecycle from MUT-001 through MUT-007.                                                                                                                                                            | SOURCE                 |
| APPM-002 | `mutateAsync` is the mutation signal's promise-returning run operation.                                                                                                                                                                              | SOURCE                 |
| APPM-003 | `mutate` returns void and internally observes rejection. It honors the full per-call lifecycle. Run creation-time then per-call callbacks in every phase; each registration's `onMutate` context is passed only to callbacks from that registration. | USER: DEC-007          |
| APPM-004 | Per-call callbacks do not replace creation-time callbacks. Apply MUT-002 and MUT-005 across both registrations, including exactly-once settled callbacks.                                                                                            | USER: DEC-006, DEC-007 |

## CRUD Composition

```ts
interface CreateCrudSignalsOptions {
  client: HttpClient;
  queryClient?: QueryClient;
  queryKey: readonly (string | number | boolean | null | undefined)[];
  resourcePath: string;
  staleTime?: number;
}

interface CrudSignals<TEntity, TCreate, TUpdate, TId extends string | number> {
  list: QuerySignal<TEntity[]>;
  create: MutationSignal<TEntity, TCreate>;
  update: MutationSignal<TEntity, { id: TId; body: TUpdate }>;
  remove: MutationSignal<undefined, TId>;
}
```

| ID       | Requirement                                                                                                                                                                                                 | Provenance |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| CRUD-001 | List performs GET on the exact resource path and forwards the query AbortSignal.                                                                                                                            | SOURCE     |
| CRUD-002 | Create POSTs its body to the resource path. Update PUTs its body to `<resourcePath>/<id>`. Remove DELETEs `<resourcePath>/<id>` and resolves `undefined`. IDs are string-interpolated without URL encoding. | SOURCE     |
| CRUD-003 | Each successful mutation invalidates the configured query-key prefix after success state is set. Failures do not invalidate.                                                                                | SOURCE     |
| CRUD-004 | Mutation requests do not receive cancellation signals and no optimistic cache update occurs.                                                                                                                | SOURCE     |

## Paginated Query

```ts
interface PagedData<TItem> {
  items: TItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
}

interface CreatePaginatedQueryOptions<TItem> extends Omit<
  CreateAppQueryOptions<PagedData<TItem>>,
  'key' | 'query' | 'select'
> {
  key: QueryKey;
  pageSize?: number;
  query(params: { page: number; pageSize: number }, signal?: AbortSignal): Promise<PagedData<TItem>>;
}

interface PaginatedQueryResult<TItem> {
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
```

| ID       | Requirement                                                                                                                                                                                                                         | Provenance    |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| PAGE-001 | Local page starts at 1 and page size at `options.pageSize ?? 20`. Cache each combination under `[...key, { page, pageSize }]` and invoke the query with the same local values and AbortSignal.                                      | SOURCE        |
| PAGE-002 | Before data, `data` is `undefined`, counts are 0, `hasNextPage` is false, and page/page size reflect local state. With data, expose all server-returned metadata except `hasPreviousPage`, which remains local page greater than 1. | SOURCE        |
| PAGE-003 | Initial page size, `setPage`, and `setPageSize` require positive finite integers and synchronously throw `RangeError` otherwise. A valid page-size change resets local page to 1.                                                   | USER: DEC-008 |
| PAGE-004 | `nextPage` increments local page only when current returned data says `hasNextPage`; `previousPage` decrements only above 1.                                                                                                        | SOURCE        |
| PAGE-005 | Changing local page or size selects the corresponding query key and follows normal automatic-fetch rules. Prior pages remain cached.                                                                                                | SOURCE        |

Input validation is addressed by DEC-008.

The wrapper intentionally omits `select`; consumers derive selected item views after it.

## Infinite Query

```ts
interface InfinitePageResult<TItem, TCursor = unknown> {
  items: TItem[];
  nextCursor?: TCursor;
}

interface CreateInfiniteQueryOptions<TItem, TCursor = unknown> extends Omit<
  CreateAppQueryOptions<InfinitePageResult<TItem, TCursor>>,
  'key' | 'query' | 'select'
> {
  key: QueryKey;
  pageSize?: number;
  query(
    params: { cursor?: TCursor; pageSize: number },
    signal?: AbortSignal,
  ): Promise<InfinitePageResult<TItem, TCursor>>;
}

interface InfiniteQueryResult<TItem> {
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
```

| ID      | Requirement                                                                                                                                                                                                                                | Provenance |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| INF-001 | Fetch the first page through an app query under the base key with `cursor: undefined` and page size `options.pageSize ?? 20`.                                                                                                              | SOURCE     |
| INF-002 | Before any additional page, next-page availability and cursor derive from the first-page `nextCursor`. Afterwards they derive from additional-page state. Cursor presence is exactly `!== undefined`; `null` is a valid cursor.            | SOURCE     |
| INF-003 | `pages` contains first-page items followed by each loaded additional-page item array; it is empty until first-page data exists. `allItems` is the flattened equivalent.                                                                    | SOURCE     |
| INF-004 | `fetchNextPage` is a no-op without a next cursor, without availability, or while another next page is fetching.                                                                                                                            | SOURCE     |
| INF-005 | Cache an additional page under `[...key, { cursor, pageSize }]`. A truthy cached page is appended synchronously without setting fetching state. Otherwise pass a new AbortSignal to the query, cache success, and append in order.         | SOURCE     |
| INF-006 | Abort of an additional page resolves the operation without error or appended data. A non-abort failure rejects but does not populate the first-page error state.                                                                           | SOURCE     |
| INF-007 | Invalidation aborts an additional-page request, clears additional pages/cursor/fetching state, resets optimistic availability, and invalidates the entire base-key prefix.                                                                 | SOURCE     |
| INF-008 | Refetch performs infinite invalidation and awaits first-page refetch. It returns void.                                                                                                                                                     | SOURCE     |
| INF-009 | Access-token and `watch` changes reset all additional-page state and invalidate the prefix after their initial values. First-page app-query invalidation also applies.                                                                     | SOURCE     |
| INF-010 | Scope cleanup aborts only the owned additional-page request; first-page cleanup follows query-signal rules. Combined `isFetching` is true for either first or additional page. Other status/error properties describe only the first page. | SOURCE     |

The wrapper intentionally omits `select` because it requires the unselected page envelope to read items and cursors.

## Context, Provider, And Boundary

```ts
interface QueryClientProviderProps extends ParentProps {
  client?: QueryClient;
  options?: CreateQueryClientOptions;
}

interface QueryBoundaryProps<TData> {
  query: AppQueryResult<TData>;
  loadingFallback?: JSX.Element;
  errorFallback?: (error: Error, retry: () => void) => JSX.Element;
  children: (data: TData) => JSX.Element;
}
```

| ID        | Requirement                                                                                                                                                                                                                                                                                     | Provenance    |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| CTX-001   | `QueryClientContext` is a Solid context. `useQueryClient` returns its value or the lazily created process-wide default client.                                                                                                                                                                  | SOURCE        |
| CTX-002   | The default client snapshots runtime query options only on first access and has no reset API.                                                                                                                                                                                                   | SOURCE        |
| CTX-003   | `QueryClientProvider` accepts children plus either a client or options. A supplied client wins; otherwise create one once from non-reactive initial props and dispose that owned client on cleanup. Never dispose a supplied client.                                                            | USER: DEC-003 |
| BOUND-001 | `QueryBoundary` checks branches in order: status loading, status error with an Error, then status success with defined data. A matched loading or error branch renders its fallback, which may itself be absent; it does not continue to a later branch. Every unmatched state renders nothing. | SOURCE        |
| BOUND-002 | The error fallback receives the current error and a void retry callback that starts `refetch` without awaiting or surfacing its rejection.                                                                                                                                                      | SOURCE        |
| BOUND-003 | Render children only when status is success and data is not `undefined`; valid falsey values other than `undefined` render.                                                                                                                                                                     | SOURCE        |

## Acceptance Criteria

1. Key examples verify stable object-property ordering, prefix matching, nullish handling, and every collision/invalid-input decision.
2. Fake time verifies default merging, retry count/delay, stale comparisons, GC thresholds, and no GC when disabled.
3. Controlled promises verify per-key deduplication, shared state, key changes, disabled behavior, retry cancellation, cleanup, and DEC-005.
4. State traces verify initial data, first load, background refetch, retained data on failure, invalidate, setData, and reset.
5. Mutation traces verify every callback order and context, callback failure, concurrent completion, reset during flight, `mutate`, and `mutateAsync`.
6. Auth and watch adapters verify readiness predicates, deferred invalidation, and selection overload behavior.
7. Fake HTTP verifies CRUD methods, paths, signal forwarding, and success-only invalidation.
8. Pagination scenarios verify separate cache keys, local/server metadata, navigation guards, and invalid sizes per DEC-008.
9. Infinite scenarios verify cached and uncached pages, cursor values including `null`, reset/refetch, additional-page failure, abort, and combined fetching state.
10. Type-level checks verify that paginated and infinite options reject `select`.
11. Provider/default-client and QueryBoundary scenarios verify precedence and every render branch, including absent fallbacks and success with `undefined` data.

## Exclusions

- Persistent, normalized, or distributed query caches.
- Focus/reconnect polling and automatic interval refetch.
- Optimistic mutation rollback or mutation cancellation.
- Runtime validation of query data.
