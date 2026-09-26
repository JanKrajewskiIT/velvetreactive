# @jankrajewskiit/reactive

Headless SolidJS primitives for shared runtime configuration, Fetch-based HTTP clients, query state, mutations, pagination, and local or remotely synchronized stores.

## Requirements

- Node.js 25 or newer for package tooling
- SolidJS 1.9 or newer supplied by the consuming application
- A browser runtime for APIs that use runtime configuration, Fetch, or Web Storage

## Installation

```sh
npm install @jankrajewskiit/reactive solid-js
```

The package is ESM-only and exposes its public API from `@jankrajewskiit/reactive`. Deep imports are not supported.

## Runtime configuration

Configure shared authentication and query defaults during browser application startup:

```ts
import { configureReactive } from '@jankrajewskiit/reactive';

configureReactive({
  getAccessToken: () => session.accessToken,
  queryClientOptions: {
    defaultOptions: {
      queries: { staleTime: 30_000 },
    },
  },
});
```

HTTP requests resolve the current token provider at request time. The default query client snapshots its options when it is first created.

## Package verification

```sh
npm run verify
```

This runs type checking, linting, contract tests, and package compatibility checks.
