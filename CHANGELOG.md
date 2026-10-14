# Changelog

## 3.6.0

- Report unexpected failures of detached mutation execution instead of leaving rejected promises unhandled.
- Serialize autosave writes, retain the latest queued edit, bound debounce/retries and persist pending snapshots before disposal.
- Expose dirty/local-persistence/conflict states. `flush()` now rejects when saving fails; consumers must handle it.
- Add HTTP failure classification and transient-read retry helpers; abort requests when their cache entries are removed.

## 3.3.6

- Add shared source/image security gates, CycloneDX SBOMs, pinned CI tooling, periodic security scans and Knip reports without changing the package version.

- Enforce the shared toolchain/editor/lint gates, validate published NodeNext declarations, and publish verified archives.

- Use Configs 3.5, CSS-free staged tasks and remove the unused direct Node type dependency.

## 3.3.0

### Breaking

- The peer range of `solid-js` is bounded to `>=1.9.0 <2`.
- Package tooling requires Node.js 26 or newer instead of 25.

### Added

- None.

### Changed

- Shared tooling comes from `@jankrajewskiit/configs` 3.3.0.
- `verify:pkg` runs `publint --strict`.
- CI and release run through the shared package workflows.

### Fixed

- None.
