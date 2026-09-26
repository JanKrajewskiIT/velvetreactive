import type { Accessor } from 'solid-js';
import { createMemo } from 'solid-js';
import { createStore as createSolidStore, reconcile, type SetStoreFunction } from 'solid-js/store';

import { type AutosaveStatus, createAutosaveController } from './autosave.js';
import { createStoreCollectionActions, type StoreCollectionActions } from './collection-actions.js';

export interface CreateSyncedStoreOptions<TData extends object> {
  key: string;
  defaultData: TData;
  fetch: (signal: AbortSignal) => Promise<TData | null | undefined>;
  save: (data: TData, signal: AbortSignal) => Promise<void>;
  normalize?: (raw: Record<string, unknown>) => TData;
  autosave?: { delayMs?: number; saveFeedbackMs?: number };
}

export interface SyncedStore<TData extends object> {
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

const shallowCopy = <TData extends object>(value: TData): TData => ({ ...value });

export const createSyncedStore = <TData extends object>(
  options: CreateSyncedStoreOptions<TData>,
): SyncedStore<TData> => {
  const storage = globalThis.localStorage;
  let restored = shallowCopy(options.defaultData);
  try {
    const stored = storage.getItem(options.key);
    if (stored) {
      const parsed = JSON.parse(stored) as unknown;
      if (parsed !== null && typeof parsed === 'object') {
        restored =
          options.normalize !== undefined
            ? options.normalize(parsed as Record<string, unknown>)
            : { ...options.defaultData, ...parsed };
      }
    }
  } catch {
    storage.removeItem(options.key);
    restored = shallowCopy(options.defaultData);
  }

  const [store, rawSetStore] = createSolidStore<TData>(restored);
  let localRevision = 0;
  const setStore = ((...args: unknown[]) => {
    (rawSetStore as unknown as (...setterArgs: unknown[]) => void)(...args);
    localRevision += 1;
  }) as SetStoreFunction<TData>;
  const serializedStore = createMemo(() => JSON.stringify(store));
  const autosave = createAutosaveController({
    source: serializedStore,
    save: async (serialized, signal) => {
      storage.setItem(options.key, serialized);
      const data = JSON.parse(serialized) as TData;
      await options.save(data, signal);
    },
    ...(options.autosave?.delayMs === undefined ? {} : { delayMs: options.autosave.delayMs }),
    ...(options.autosave?.saveFeedbackMs === undefined ? {} : { saveFeedbackMs: options.autosave.saveFeedbackMs }),
  });
  let initialized = false;
  let initPromise: Promise<void> | null = null;
  let initController: AbortController | undefined;

  const normalize = (data: TData): TData =>
    options.normalize === undefined ? data : options.normalize(data as Record<string, unknown>);

  const init = (): Promise<void> => {
    if (initialized) return Promise.resolve();
    if (initPromise !== null) return initPromise;
    const revisionAtStart = localRevision;
    const controller = new AbortController();
    initController = controller;
    const task = (async () => {
      const fetched = await options.fetch(controller.signal);
      if (controller.signal.aborted) throw new Error('Synchronized store initialization aborted');
      if (fetched !== null && fetched !== undefined) {
        const normalized = normalize(fetched);
        if (localRevision === revisionAtStart) {
          const serialized = JSON.stringify(normalized);
          autosave.skipNextChange(serialized);
          rawSetStore(reconcile(normalized));
          storage.setItem(options.key, serialized);
        }
      }
      initialized = true;
    })();
    const operation = task.finally(() => {
      if (initPromise === operation) initPromise = null;
      if (initController === controller) initController = undefined;
    });
    initPromise = operation;
    return operation;
  };

  return {
    store,
    setStore,
    saveStatus: autosave.status,
    error: autosave.error,
    init,
    flush: () => autosave.flush(),
    importData: (data) => setStore(reconcile(normalize(data))),
    collectionActions: <TItem extends { id: string }>(key: keyof TData & string) =>
      createStoreCollectionActions<TItem>(setStore, key),
    dispose: () => {
      initController?.abort();
      initController = undefined;
      autosave.dispose();
    },
  };
};
