# @jankrajewskiit/reactive

Headless reactive primitives extracted from `@jankrajewskiit/ui`:

- **`store/`** — `createSyncedStore`, `createAutosaveSignal`,
  `createPersistedSignal`, `createSelectionStore`, `createEntityStore`,
  `createStoreCollectionActions`.
- **`query/`** — `createQueryClient`, `createQuerySignal`,
  `createMutationSignal`, `createPaginatedQuery`, `createInfiniteQuery`,
  `createCrudSignals`, `createAppQuery`, `createAppMutation`,
  `QueryClientProvider`, `QueryBoundary`, `useQueryClient`.
- **`http/`** — `createHttpClient`, `createApiClients`,
  `unwrapCollectionResponse`, `ApiError`.

## Peer dependencies

- `solid-js`

## Runtime configuration

`createHttpClient` and the default `QueryClient` read from a small runtime
config exposed by `configureReactive`. Wire it once in your bootstrap, e.g.:

```ts
import { configureReactive } from '@jankrajewskiit/reactive';
import { getAuthAccessToken, type OidcAuthConfig } from '@jankrajewskiit/auth';

const authConfig: OidcAuthConfig = {
  /* ... */
};

configureReactive({
  getAccessToken: () => getAuthAccessToken(authConfig),
  queryClientOptions: {
    defaultOptions: { queries: { staleTime: 30_000 } },
  },
});
```

Without `getAccessToken`, requests go out unauthenticated. Without
`queryClientOptions`, defaults are used.
