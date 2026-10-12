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

The release workflow signs the verified archive and its dependency SBOM with Cosign. Download the `package-signatures` artifact and verify the bundle against the expected release workflow identity. npm registry signatures are a separate mechanism; where supported, inspect the dependency tree with:

```sh
npm audit signatures
```

Registry signature and provenance support must be confirmed during publication; the workflow configuration does not itself establish those guarantees.

## Release workflow

1. Confirm the default branch is green and `CHANGELOG.md` has a section for the new version.
2. `npm version patch|minor|major` and commit the changelog edit with the bump.
3. `git push --follow-tags`.

The `v<semver>` tag verifies and packs once, checks the archive against the release version, then publishes the verified archive. Provenance is requested by default; failures do not automatically fall back to an unsigned publication.

Recover from a broken release by publishing a superseding patch and running `npm deprecate @jankrajewskiit/reactive@<broken-version> "<reason>"`. Never unpublish a version consumers may have installed.

## Branch protection

Protect the default branch with:

- a required, passing `verify` status check that includes the `npm audit` step;
- at least one approving CODEOWNERS review;
- a branch that is up to date before merging;
- force pushes and non-administrative direct pushes disabled.

## Toolchain compatibility

Builds use TypeScript 7 (`@typescript/native`, providing `tsc`). TypeScript 6 stays under the `typescript` alias for tools importing its JavaScript API (`tsc6` is its separate binary). ESLint 10 is selected by a root `eslint: "$eslint"` override because the accessibility plugin still declares peers only through ESLint 9; Configs adapts legacy rule APIs. Install the Configs release required by this manifest before running the updated presets.

## Shared configuration

Use Node 26 and the exact npm version from `packageManager`. Open `frontend.code-workspace` for TypeScript 7 and the shared formatter/linter setup. `verify` checks editor drift and enforces zero lint warnings. `audit:deps` is a separate networked dependency audit used by CI.

Published declarations are checked with `NodeNext` and `skipLibCheck: false`; package checks no longer ignore internal resolution errors. Vite libraries publish `.mjs` and `.d.mts`, while Reactive retains its valid TypeScript `NodeNext` `.js`/`.d.ts` output. Public package import paths stay the same.

See the [Configs release migration](https://github.com/JanKrajewskiIT/velvetconfigs/blob/v3.5.0/README.md#release-migration) for publication order, artifact-based workflows, the audit exception deadline and registry secrets. Refresh lockfiles and run `npm run verify` against the refreshed installation before publication.

## Security pipeline

Source verification includes Gitleaks, Semgrep, actionlint, zizmor and Trivy configuration scanning. npm audit blocks high/critical advisories under the shared expiring-exception policy. Verification produces a CycloneDX dependency SBOM. Weekly/manual security workflows re-check dependency databases and source history without building the application.

Knip is available through `npm run deps:check` (JSON report) and `npm run deps:strict` (blocking unused-code check). CI records the report while the initial findings are reviewed; security scans remain blocking. Public library entry exports are preserved.

Configure `CONFIGS_READ_TOKEN` for private Configs source access alongside the existing npm read token. See [shared security controls](https://github.com/JanKrajewskiIT/velvetconfigs/blob/v3.5.0/security/README.md) for required GitHub settings, reports, image signing, staging variables, WAF activation and manual acceptance checks.
