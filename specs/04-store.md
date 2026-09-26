# Task 04: Store Primitives

## Purpose

Provide local reactive collections and selection, synchronous storage persistence, debounced autosave, and a store synchronized with browser storage and a consumer-owned remote service.

## Autosave Signal

```ts
type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface CreateAutosaveSignalOptions<TData> {
  source: Accessor<TData>;
  save: (data: TData, signal: AbortSignal) => Promise<void>;
  delayMs?: number;
  saveFeedbackMs?: number;
}

interface AutosaveSignal {
  status: Accessor<AutosaveStatus>;
  error: Accessor<Error | undefined>;
  isSaving: Accessor<boolean>;
  flush(): Promise<void>;
}
```

| ID       | Requirement                                                                                                                                                                                                                                                                                                                     | Provenance    |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| AUTO-001 | Initial status is idle with no error. Default debounce is 500 ms and saved feedback is 3000 ms. Nullish defaulting preserves explicit zero and negative values for platform timer semantics.                                                                                                                                    | SOURCE        |
| AUTO-002 | Observe the source after setup without scheduling an initial save. On each later distinct source value, cancel the pending debounce and schedule that captured snapshot.                                                                                                                                                        | SOURCE        |
| AUTO-003 | Starting a save clears pending saved-feedback, aborts the previous save, creates and passes a new signal, sets saving, and clears the previous error. A source change alone does not abort an active save until its debounce fires.                                                                                             | USER: DEC-009 |
| AUTO-004 | A non-aborted success sets saved, then sets idle after the feedback duration. A non-aborted failure becomes the original `Error` or `Error('Autosave failed')`, sets error status, and remains until another save starts.                                                                                                       | SOURCE        |
| AUTO-005 | Completion or failure from an aborted save must not alter status or error. Correctness does not require the consumer callback to stop promptly after abort.                                                                                                                                                                     | SOURCE        |
| AUTO-006 | `flush` cancels a pending debounce and immediately saves a fresh `source()` snapshot. It aborts any active save through normal start semantics. A save rejection is captured as autosave state and `flush` resolves; a synchronous failure while evaluating `source()` rejects. It always saves even when no change is pending. | SOURCE        |
| AUTO-007 | Scope cleanup aborts the active save and clears pending debounce and feedback timers.                                                                                                                                                                                                                                           | SOURCE        |
| AUTO-008 | `isSaving` is exactly `status() === 'saving'`.                                                                                                                                                                                                                                                                                  | SOURCE        |

Overlapping feedback and a newer save are addressed by DEC-009.

## Persisted Signal

```ts
interface PersistStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface CreatePersistedSignalOptions<T> {
  storage?: PersistStorage;
  serialize?: (value: T) => string;
  deserialize?: (value: string) => T;
}

declare function createPersistedSignal<T>(
  key: string,
  initialValue: T,
  options?: CreatePersistedSignalOptions<T>,
): [Accessor<T>, (next: T | ((previous: T) => T)) => void];
```

| ID          | Requirement                                                                                                                                                                                                                                   | Provenance    |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| PERSIST-001 | Use supplied storage or `globalThis.localStorage` when that property exists; otherwise operate as an in-memory signal. Without storage, setters update memory and silently skip persistence. There is no public export for storage discovery. | SOURCE        |
| PERSIST-002 | Default serialization is `JSON.stringify`; default deserialization is `JSON.parse` cast to `T`.                                                                                                                                               | SOURCE        |
| PERSIST-003 | Read the storage key synchronously during creation. Missing storage, a `null` result, or a read failure uses `initialValue`; a read failure treats storage as unavailable for that signal instance.                                           | USER: DEC-010 |
| PERSIST-004 | On deserialization failure, best-effort call `removeItem(key)` when that method exists, ignore removal failure, and use `initialValue`. Do not rewrite malformed data or report through a callback.                                           | USER: DEC-010 |
| PERSIST-005 | The setter accepts a value or updater, resolves it once against current state, serializes and writes synchronously when storage exists, then commits the resolved signal value.                                                               | SOURCE        |
| PERSIST-006 | Serialization or `setItem` failure propagates and prevents the setter callback from returning the new value to the underlying signal, so the in-memory value remains unchanged under standard SolidJS setter semantics.                       | SOURCE        |
| PERSIST-007 | There is no removal API, cross-document `storage` event handling, migration/versioning, expiry, or runtime validation.                                                                                                                        | SOURCE        |

Error recovery policy is addressed by DEC-010.

## Entity Store

```ts
interface CreateEntityStoreOptions<T, Id extends PropertyKey> {
  getId: (item: T) => Id;
  initialItems?: T[];
}

interface EntityStore<T, Id extends PropertyKey> {
  ids: Accessor<Id[]>;
  entities: Accessor<ReadonlyMap<Id, T>>;
  list: Accessor<T[]>;
  getById(id: Id): T | undefined;
  setAll(items: T[]): void;
  upsert(item: T): void;
  remove(id: Id): void;
  clear(): void;
}
```

| ID         | Requirement                                                                                                                               | Provenance |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| ENTITY-001 | Initialize empty, then apply non-empty initial items using `setAll`.                                                                      | SOURCE     |
| ENTITY-002 | `setAll` replaces the collection. IDs come from `getId`; duplicate IDs keep the last value while retaining Map insertion-order semantics. | SOURCE     |
| ENTITY-003 | `upsert` replaces an existing value without moving its order or appends a new ID. Publish a new Map reference.                            | SOURCE     |
| ENTITY-004 | `remove` is an identity-preserving no-op when absent; when present, remove it and publish a new Map. `clear` publishes a new empty Map.   | SOURCE     |
| ENTITY-005 | `ids` and `list` reactively reflect Map key/value iteration order. `getById` reads current state.                                         | SOURCE     |
| ENTITY-006 | The store performs no ID validation, sorting, cloning of items, or equality suppression beyond the absent-remove no-op.                   | SOURCE     |

## Selection Store

```ts
interface CreateSelectionStoreOptions<TId = string, TSort = string> {
  initialSelectedId?: TId | null;
  initialFilter?: string;
  initialSortBy?: TSort | null;
}

interface SelectionStore<TId = string, TSort = string> {
  selectedId: Accessor<TId | null>;
  filter: Accessor<string>;
  sortBy: Accessor<TSort | null>;
  hasSelection: Accessor<boolean>;
  setSelectedId(id: TId | null): void;
  setFilter(value: string): void;
  setSortBy(value: TSort | null): void;
  clear(): void;
}
```

| ID         | Requirement                                                                                                                                   | Provenance |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| SELECT-001 | Defaults are selected ID `null`, filter `''`, and sort `null`; nullish initial values fall back to those defaults.                            | SOURCE     |
| SELECT-002 | Setters assign without normalization or validation. `hasSelection` is exactly selected ID not equal to `null`.                                | SOURCE     |
| SELECT-003 | `clear` synchronously sets selected ID to `null`, then filter to `''`, then sort to `null`. No persistence or coupling between fields exists. | SOURCE     |

## Store Collection Actions

```ts
interface StoreCollectionActions<TItem> {
  add(item: TItem): void;
  update(item: TItem): void;
  remove(id: string): void;
}

declare function createStoreCollectionActions<TItem extends { id: string }>(
  setStore: (...args: never[]) => void,
  key: string,
): StoreCollectionActions<TItem>;
```

| ID       | Requirement                                                                                                                                             | Provenance |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| COLL-001 | Treat `key` as an array-valued path accepted by a Solid store setter. The public types do not prove that relationship and runtime validation is absent. | SOURCE     |
| COLL-002 | `add` appends the exact item and permits duplicate IDs.                                                                                                 | SOURCE     |
| COLL-003 | `update` applies Solid-compatible reconciliation to every array entry whose `id` equals the supplied item's ID. A missing ID is a no-op.                | SOURCE     |
| COLL-004 | `remove` filters out every item with the supplied ID. A missing ID is a no-op.                                                                          | SOURCE     |

## Synchronized Store

```ts
interface CreateSyncedStoreOptions<TData extends object> {
  key: string;
  defaultData: TData;
  fetch: (signal: AbortSignal) => Promise<TData | null | undefined>;
  save: (data: TData, signal: AbortSignal) => Promise<void>;
  normalize?: (raw: Record<string, unknown>) => TData;
  autosave?: { delayMs?: number; saveFeedbackMs?: number };
}

interface SyncedStore<TData extends object> {
  store: TData;
  setStore: SetStoreFunction<TData>;
  saveStatus: Accessor<AutosaveStatus>;
  error: Accessor<Error | undefined>;
  init(): Promise<void>;
  flush(): Promise<void>;
  importData(data: TData): void;
  collectionActions<TItem extends { id: string }>(key: keyof TData & string): StoreCollectionActions<TItem>;
  dispose(): void;
}
```

### Construction And Local Restore

| ID       | Requirement                                                                                                                                                                                                                            | Provenance |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| SYNC-001 | This primitive is browser-only and directly requires global `localStorage`. It does not accept alternate storage.                                                                                                                      | SOURCE     |
| SYNC-002 | During construction, read `localStorage[key]`. A missing or empty string uses a shallow copy of default data.                                                                                                                          | SOURCE     |
| SYNC-003 | Parse a truthy stored string as JSON. If the result is a non-null object, pass it to `normalize` when supplied; otherwise shallow-merge its enumerable properties over default data. Arrays satisfy the object check.                  | SOURCE     |
| SYNC-004 | If read, parse, or normalization fails, attempt to remove the key and use a shallow copy of defaults. A failure from `removeItem` itself propagates.                                                                                   | SOURCE     |
| SYNC-005 | Construct a Solid store from the restored result. Observe the full JSON serialization of that store with deferred autosave, so construction alone does not save. Changes with the same serialized string do not schedule another save. | SOURCE     |

### Autosave And Remote Save

| ID       | Requirement                                                                                                                                                                                                                                        | Provenance |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| SYNC-006 | Use task 04 autosave timing/state semantics with the serialized store string as its source.                                                                                                                                                        | SOURCE     |
| SYNC-007 | For a save snapshot, synchronously write the serialized string to localStorage, parse it back to `TData`, then await the consumer `save(data, signal)`. A local write or parse failure prevents the remote callback and appears as autosave error. | SOURCE     |
| SYNC-008 | Expose autosave status/error directly. `flush` delegates to autosave and therefore always writes and remotely saves the current serializable store.                                                                                                | SOURCE     |

### Initialization And Import

| ID       | Requirement                                                                                                                                                                                                                                                                                                  | Provenance    |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- |
| SYNC-009 | Concurrent `init` calls return the same in-flight promise. Pass one AbortSignal to fetch. A failure rejects all waiters and permits a later retry; success makes later calls resolve without another fetch.                                                                                                  | USER: DEC-011 |
| SYNC-010 | Record a local-edit revision when init begins. A response of `null` or `undefined` leaves state unchanged. Normalize a present response, but apply it only if no local edit occurred since init began; otherwise discard it.                                                                                 | USER: DEC-011 |
| SYNC-011 | When applied, reconcile the store to the complete normalized response and write it to localStorage once. Applying fetched data alone must not invoke remote save; the next actual local edit follows normal autosave. Normalization, reconciliation, serialization, storage, and fetch errors reject `init`. | USER: DEC-011 |
| SYNC-012 | A local edit is any mutation of this synced store made through its exposed `setStore`, `importData`, or collection actions. Internal application of fetched data is not a local edit. Values owned outside this store do not affect its revision.                                                            | USER: DEC-011 |
| SYNC-013 | `importData` synchronously normalizes when configured and reconciles the store. Errors propagate. The resulting change schedules normal autosave. It does not directly write storage or call remote save.                                                                                                    | SOURCE        |

### Lifetime And Concurrency

| ID       | Requirement                                                                                                                                                                                                | Provenance    |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| SYNC-014 | `collectionActions(key)` creates and returns collection helpers for that key on every call.                                                                                                                | SOURCE        |
| SYNC-015 | `dispose` stops autosave ownership, aborts its active save and init, and clears timers. It does not invalidate the store or prevent later local mutations; those mutations are no longer autosaved.        | USER: DEC-011 |
| SYNC-016 | The package supplies no timeout. Init, import, direct store edits, flush, and autosave may overlap, but revision and abort rules prevent stale init or save completion from overwriting newer local state. | USER: DEC-011 |
| SYNC-017 | No storage events, conflict versions, server revisions, retries, offline queue, or merge protocol are provided. Last external side effect by execution order wins.                                         | SOURCE        |

## Acceptance Criteria

1. Fake clocks and controlled promises verify every autosave transition, snapshot timing, flush, abort, cleanup, and DEC-009.
2. Custom storage verifies persisted-signal restore, malformed content, functional updates, absent storage, and read/write/serialization failures.
3. Entity scenarios verify ordering, duplicate IDs, reference replacement, and absent removal.
4. Selection scenarios verify null/default semantics, falsey generic IDs, field independence, and clear.
5. A real Solid store fixture verifies append, duplicate update/removal, missing IDs, and nested reconciliation.
6. Fake localStorage and remote callbacks verify synchronized construction, malformed storage removal, normalization at all boundaries, one-shot init, suppressed init failures, deferred saves, import, flush, and dispose.
7. Controlled overlaps verify the approved resolutions for init/autosave/flush races and stale save completion.

## Exclusions

- Cross-tab synchronization, migrations, encryption, storage quotas, or schema validation.
- Offline queues, remote conflict resolution, save retries, and server revision tracking.
- Automatic normalization for entity, selection, or collection primitives.
