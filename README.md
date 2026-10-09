# @jankrajewskiit/reactive

Headless SolidJS primitives for shared runtime configuration, Fetch-based HTTP clients, query state, mutations, pagination, and local or remotely synchronized stores.

## Requirements

- Node.js 26 or newer for package tooling
- SolidJS 1.9 or newer supplied by the consuming application
- A browser runtime for APIs that use runtime configuration, Fetch, or Web Storage

## Installation

The package is published to GitHub Packages. Route the scope in the consumer's `.npmrc`:

```ini
@jankrajewskiit:registry=https://npm.pkg.github.com/
//npm.pkg.github.com/:_authToken=${GHCR_TOKEN}
```

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

## Lifetimes

Query, app-query, paginated, infinite, and autosave primitives register effects and cleanups, so they must be created inside a reactive owner such as a component or `createRoot`. `createSyncedStore` owns its own root; call `dispose()` when it is no longer needed.

## Package verification

```sh
npm run verify
```

This runs type checking, linting, the build, and package compatibility checks.

## Upgrading

Changes for every published version are recorded in [CHANGELOG.md](CHANGELOG.md).

## Provenance verification

Releases are published with npm provenance. Verify an installed version with:

```sh
npm audit signatures @jankrajewskiit/reactive
```

A passing audit attests that the registry signature and the sigstore provenance attestation match the tarball, which ties it to the source commit and the publish workflow run.

## Release workflow

1. Confirm the default branch is green and `CHANGELOG.md` has a section for the new version.
2. `npm version patch|minor|major` and commit the changelog edit with the bump.
3. `git push --follow-tags`.

The `v<semver>` tag starts `publish.yml`: verify, version check, then `npm publish --provenance --access public`. A failed provenance step fails the run; re-run it against the same tag once sigstore is reachable.

Recover from a broken release by publishing a superseding patch and running `npm deprecate @jankrajewskiit/reactive@<broken-version> "<reason>"`. Never unpublish a version consumers may have installed.

## Branch protection

Protect the default branch with:

- a required, passing `verify` status check that includes the `npm audit` step;
- at least one approving CODEOWNERS review;
- a branch that is up to date before merging;
- force pushes and non-administrative direct pushes disabled.
