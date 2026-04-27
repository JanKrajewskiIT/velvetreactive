import { type Accessor, createRoot } from 'solid-js';
import { createStore, reconcile, type SetStoreFunction } from 'solid-js/store';

import { type AutosaveStatus, createAutosaveSignal } from './createAutosaveSignal';
import { createStoreCollectionActions, type StoreCollectionActions } from './createStoreCollectionActions';

export interface CreateSyncedStoreOptions<TData extends object> {
  key: string;
  defaultData: TData;
  fetch: () => Promise<TData | null | undefined>;
  save: (data: TData, signal: AbortSignal) => Promise<void>;
  normalize?: (raw: Record<string, unknown>) => TData;
  autosave?: { delayMs?: number; saveFeedbackMs?: number };
}

export interface SyncedStore<TData extends object> {
  store: TData;
  setStore: SetStoreFunction<TData>;
  saveStatus: Accessor<AutosaveStatus>;
  error: Accessor<Error | undefined>;
  init: () => Promise<void>;
  flush: () => Promise<void>;
  importData: (data: TData) => void;
  collectionActions: <TItem extends { id: string }>(key: keyof TData & string) => StoreCollectionActions<TItem>;
}

export const createSyncedStore = <TData extends object>(
  options: CreateSyncedStoreOptions<TData>,
): SyncedStore<TData> => {
  const loadFromStorage = (): TData => {
    try {
      const stored = localStorage.getItem(options.key);
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (typeof parsed === 'object' && parsed !== null) {
          if (options.normalize) {
            return options.normalize(parsed as Record<string, unknown>);
          }
          return { ...options.defaultData, ...(parsed as Partial<TData>) };
        }
      }
    } catch {
      localStorage.removeItem(options.key);
    }
    return { ...options.defaultData };
  };

  const [store, setStore] = createStore<TData>(loadFromStorage());

  let initialized = false;

  const autosave = createRoot(() =>
    createAutosaveSignal({
      source: () => JSON.stringify(store),
      save: async (serialized, signal) => {
        localStorage.setItem(options.key, serialized);
        const data = JSON.parse(serialized) as TData;
        await options.save(data, signal);
      },
      delayMs: options.autosave?.delayMs,
      saveFeedbackMs: options.autosave?.saveFeedbackMs,
    }),
  );

  const init = async (): Promise<void> => {
    if (initialized) return;
    initialized = true;

    try {
      const response = await options.fetch();
      if (!response) return;

      const normalized = options.normalize
        ? options.normalize(response as unknown as Record<string, unknown>)
        : response;
      setStore(reconcile(normalized));
      localStorage.setItem(options.key, JSON.stringify(normalized));
    } catch {
      /* init failure is non-fatal — localStorage data is used as fallback */
    }
  };

  const importData = (data: TData): void => {
    const normalized = options.normalize ? options.normalize(data as unknown as Record<string, unknown>) : data;
    setStore(reconcile(normalized));
  };

  const collectionActions = <TItem extends { id: string }>(key: keyof TData & string): StoreCollectionActions<TItem> =>
    createStoreCollectionActions<TItem>(setStore, key);

  return {
    store,
    setStore,
    saveStatus: autosave.status,
    error: autosave.error,
    init,
    flush: autosave.flush,
    importData,
    collectionActions,
  };
};
