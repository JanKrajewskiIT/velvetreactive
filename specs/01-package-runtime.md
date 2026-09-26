# Task 01: Package And Runtime

## Purpose

Deliver the package shell and browser runtime configuration on which the HTTP and query tasks depend.

## Public Contract

The package root must export these types and values:

```ts
interface ReactiveRuntimeConfig {
  getAccessToken?: () => Promise<string | undefined> | string | undefined;
  queryClientOptions?: CreateQueryClientOptions;
}

interface ConfigureReactiveOptions {
  getAccessToken?: () => Promise<string | undefined> | string | undefined;
  queryClientOptions?: CreateQueryClientOptions;
}

declare const configureReactive: (options: ConfigureReactiveOptions) => void;
declare const getReactiveRuntimeConfig: () => Readonly<ReactiveRuntimeConfig>;
```

`CreateQueryClientOptions` is defined by task 03.

## Requirements

| ID      | Requirement                                                                                                                                                                                                                               | Provenance    |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| PKG-001 | Publish a single ESM root entry with matching runtime and declaration files.                                                                                                                                                              | SOURCE        |
| PKG-002 | Re-export every public contract from tasks 01-04 from the package root.                                                                                                                                                                   | SOURCE        |
| PKG-003 | Keep SolidJS external and declare `solid-js >=1.9` as a peer dependency.                                                                                                                                                                  | SOURCE        |
| PKG-004 | Declare `sideEffects: false`, Node tooling support `>=25`, and npm 11 package-manager intent.                                                                                                                                             | SOURCE        |
| PKG-005 | Do not expose contractual subpath imports.                                                                                                                                                                                                | SOURCE        |
| RUN-001 | Runtime configuration is one browser-process module singleton shared by HTTP and the default query client.                                                                                                                                | SOURCE        |
| RUN-002 | `configureReactive` throws an `Error` containing that configuration is browser-only when `window` is absent. It performs no partial update before throwing.                                                                               | SOURCE        |
| RUN-003 | Each supplied, non-`undefined` option replaces the corresponding singleton field. Omitted or explicitly `undefined` fields preserve their previous values. Repeated calls therefore merge field-by-field rather than reset configuration. | SOURCE        |
| RUN-004 | `getReactiveRuntimeConfig` returns a new shallow readonly snapshot on every call. Mutating a returned object cannot alter runtime configuration.                                                                                          | USER: DEC-012 |
| RUN-005 | Configuration itself does not invoke the token provider or construct a query client.                                                                                                                                                      | SOURCE        |
| RUN-006 | The first creation of the default query client snapshots the then-current `queryClientOptions`; later configuration does not replace that client or update its defaults.                                                                  | SOURCE        |
| RUN-007 | HTTP requests resolve the current `getAccessToken` provider at request time, so replacing that provider affects later requests.                                                                                                           | SOURCE        |

## Operational Constraints

- Runtime configuration is browser-scoped and is not SSR-safe.
- Consumers configure the runtime before constructing consumers that obtain the default query client.
- No reset API is part of the public contract.
- No environment variables or secrets are read by this package.

## Acceptance Criteria

1. A clean ESM consumer imports all documented root exports and TypeScript resolves their declarations.
2. Importing the package alone performs no browser-only work.
3. Calling `configureReactive` without `window` throws and leaves the configuration unchanged.
4. Two browser calls that supply different fields preserve both values; supplying `undefined` does not clear a previous value.
5. `getReactiveRuntimeConfig()` returns distinct snapshots before and after updates; older snapshots stay unchanged and direct mutation cannot affect later reads.
6. A default query client created before a configuration change retains its original defaults, while a later HTTP request uses the latest token provider.

## Exclusions

- A configuration reset API.
- Per-request runtime configuration scopes.
- Server-side runtime isolation.
- CommonJS output or public deep imports.
