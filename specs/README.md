# Velvet Reactive Clean-Room Specification

Version: `1.0-approved`

Status: approved

## Outcome

Rebuild `@jankrajewskiit/reactive` as a headless SolidJS library whose public API and ordinary observable behavior are compatible with version `0.1.4`, except for the explicitly approved corrections in [05-decisions.md](05-decisions.md), while allowing a new internal design. The approved files in this directory become the sole implementation brief for the rebuilding agent.

## Consumers

- Browser applications built with SolidJS 1.9 or newer.
- TypeScript consumers importing only the package root.
- Applications that need a shared runtime configuration, HTTP clients, client-side query state, and local or remotely synchronized stores.

## Rebuild Boundary

The rebuild includes:

- package metadata and the root ESM entry point;
- runtime configuration;
- HTTP primitives;
- query, mutation, cache, pagination, and boundary primitives;
- local, persisted, normalized, selection, autosave, and synchronized stores.

The rebuild excludes:

- UI styling and product-specific components;
- authentication implementation beyond accepting an access-token provider or auth-state adapter;
- server APIs, schemas, and persistence owned by consuming applications;
- compatibility with undocumented deep imports;
- the legacy source layout, helper names, algorithms, and private state representation.

## Required Technology And Compatibility

| ID       | Requirement                                                                                                                                                               | Provenance                                           |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| CORE-001 | The package name is `@jankrajewskiit/reactive`.                                                                                                                           | SOURCE: `package.json` 0.1.4                         |
| CORE-002 | The package is ESM-only and exposes one public package entry point, `.`.                                                                                                  | SOURCE: `package.json` 0.1.4                         |
| CORE-003 | The root entry point provides all public values and types listed by tasks 01-04. Deep imports are not contractual.                                                        | SOURCE: package export map and public barrels        |
| CORE-004 | `solid-js >=1.9` is a host-provided peer dependency and must not be bundled.                                                                                              | SOURCE: package and build configuration              |
| CORE-005 | The published entry point provides matching JavaScript and TypeScript declarations.                                                                                       | SOURCE: package export map                           |
| CORE-006 | The package declares no import-time side effects and remains tree-shakeable. Runtime singletons are created lazily or remain inert until called.                          | SOURCE: package metadata and runtime behavior        |
| CORE-007 | The supported runtime is a browser with Fetch, AbortController, URL, and Web Storage where required. Only explicitly documented fallbacks may operate without these APIs. | SOURCE: executable runtime dependencies              |
| CORE-008 | Public asynchronous failures are `Error` instances unless a contract explicitly preserves an external error.                                                              | SOURCE: HTTP, query, mutation, and autosave behavior |
| CORE-009 | Public reactive values use SolidJS accessors, stores, context, and JSX contracts as specified.                                                                            | SOURCE: exported declarations                        |
| CORE-010 | Consumers must be able to use the package from Node.js 25 or newer tooling. Browser behavior remains the runtime target.                                                  | SOURCE: package engines                              |
| CORE-018 | Do not republish the replacement as version `0.1.4`. The release owner must assign a later version consistent with the approved compatibility changes before publication. | ASSUMPTION: resolve at release                       |

## Specification Tasks

| Task                                           | Primary outcome                                                              | Depends on                     |
| ---------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------ |
| [01-package-runtime.md](01-package-runtime.md) | Publishable package and runtime configuration contract                       | none                           |
| [02-http.md](02-http.md)                       | HTTP transport, errors, URL/body helpers, and client groups                  | task 01                        |
| [03-query.md](03-query.md)                     | Query cache, query/mutation state, wrappers, pagination, and JSX integration | task 01; task 02 for CRUD only |
| [04-store.md](04-store.md)                     | Local reactive stores, persistence, autosave, and remote synchronization     | task 01                        |
| [05-decisions.md](05-decisions.md)             | Compatibility decisions for questionable legacy behavior                     | blocks final approval          |

Tasks 02, 03, and 04 may be implemented independently after task 01. CRUD integration in task 03 additionally depends on task 02.

## Source Inventory And Provenance

Requirements marked `SOURCE` were extracted from executable evidence in version `0.1.4`:

- package manifest, TypeScript project configuration, and build configuration;
- root, HTTP, query, and store public entry points;
- runtime configuration implementation;
- all implementation modules reachable through the public entry point.

`USER` identifies an explicit user decision. `AGENT` identifies an agent proposal. `ASSUMPTION` identifies unresolved input and includes a resolution condition. All decisions in [05-decisions.md](05-decisions.md) are approved `USER` requirements and override conflicting `SOURCE` requirements that describe legacy behavior.

The legacy implementation is evidence for behavior, not a design template. File paths above establish provenance only and are not implementation instructions.

## Shared Behavioral Requirements

| ID       | Requirement                                                                                                                                                                                          | Provenance                                               |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| CORE-011 | Public generic types preserve the input/output relationships documented in each task; the implementation must not replace them with `any`.                                                           | SOURCE: exported declarations                            |
| CORE-012 | Optional values, `null`, and `undefined` remain distinct where a task gives them different meanings.                                                                                                 | SOURCE: public contracts                                 |
| CORE-013 | Timing defaults are observable contracts. User-supplied zero values must not be replaced by defaults.                                                                                                | SOURCE: debounce, retry, stale, feedback, and GC options |
| CORE-014 | Cleanup aborts or cancels work owned by a SolidJS reactive scope as described, without allowing stale work to overwrite newer state.                                                                 | SOURCE: query, infinite-query, and autosave lifecycles   |
| CORE-015 | Consumer callbacks run in the documented order and receive the documented context. Callback exceptions follow the same promise path as the phase in which they run.                                  | SOURCE: interceptor and mutation lifecycles              |
| CORE-016 | No remote response or stored value is runtime-validated unless a task explicitly requires parsing, normalization, or structural discovery. Generic type parameters are compile-time assertions only. | SOURCE: transport and persistence behavior               |
| CORE-017 | No retries, timeouts, cross-tab synchronization, optimistic updates, automatic rollback, or schema validation exist unless explicitly required in a task.                                            | SOURCE: absence in public behavior                       |

## Shared Acceptance Evidence

The replacement is acceptable when a clean consumer fixture can demonstrate all of the following without access to the legacy implementation:

1. The package installs using its declared peer dependency and resolves the root ESM import and declarations.
2. Every public value and type listed in tasks 01-04 is available from the root import with the specified generic contract.
3. Deterministic contract scenarios for HTTP, query state, mutation callbacks, pagination, persistence, autosave, and synchronized stores produce the specified outputs and state transitions.
4. Fake clocks can verify debounce, feedback, retry delay, staleness, and garbage-collection timing.
5. Controlled promises and AbortSignals can verify deduplication, cancellation, stale-result protection, and documented race behavior.
6. Fake Fetch, Web Storage, and auth adapters can verify all external effects without a live backend.
7. The packed artifact contains only intentional distributable files and passes package-contract checks for an ESM-only package.

## Handoff And Freeze

For this approved version:

- these specification files are the sole implementation brief;
- the rebuilding agent must not inspect the old source, source diffs, generated output, or implementation-specific documentation;
- acceptance is based on public contracts and observable scenarios in these files, not structural similarity;
- removal or archival of the old implementation requires separate explicit approval.
