import type { Accessor } from 'solid-js';
import { batch, createEffect, createMemo, createRoot, on, onCleanup, untrack } from 'solid-js';
import type { SetStoreFunction } from 'solid-js/store';
import { createStore, reconcile } from 'solid-js/store';

import { getLocalStorage } from '../shared/getLocalStorage.js';
import type { AutosaveStatus } from './autosaveRunner.js';
import { createAutosaveRunner } from './autosaveRunner.js';
import type { StoreCollectionActions } from './storeCollectionActions.js';
import { createStoreCollectionActions } from './storeCollectionActions.js';

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
  init: () => Promise<void>;
  flush: () => Promise<void>;
  importData: (data: TData) => void;
  collectionActions: <TItem extends { id: string }>(key: keyof TData & string) => StoreCollectionActions<TItem>;
  dispose: () => void;
}

type LooseStoreSetter = (...args: unknown[]) => void;

const requireLocalStorage = (): Storage => {
  const storage = getLocalStorage();
  if (storage === undefined) {
    throw new Error('createSyncedStore requires localStorage, which is unavailable in this environment.');
  }
  return storage;
};

const restoreData = <TData extends object>(
  storage: Storage,
  key: string,
  defaultData: TData,
  normalize: CreateSyncedStoreOptions<TData>['normalize'],
): TData => {
  try {
    const stored = storage.getItem(key);
    if (stored === null || stored === '') {
      return { ...defaultData };
    }
    const parsed = JSON.parse(stored) as unknown;
    if (typeof parsed !== 'object' || parsed === null) {
      return { ...defaultData };
    }
    return normalize === undefined ? { ...defaultData, ...parsed } : normalize(parsed as Record<string, unknown>);
  } catch {
    storage.removeItem(key);
    return { ...defaultData };
  }
};

export const createSyncedStore = <TData extends object>({
  key,
  defaultData,
  fetch: fetchRemote,
  save: saveRemote,
  normalize,
  autosave,
}: CreateSyncedStoreOptions<TData>): SyncedStore<TData> => {
  const storage = requireLocalStorage();
  const restored = restoreData(storage, key, defaultData, normalize);

  return createRoot<SyncedStore<TData>>((disposeRoot) => {
    const [store, setRawStore] = createStore<TData>(restored);
    let localEditRevision = 0;
    let syncedSnapshot: string | undefined;

    const markLocalEdit = (): void => {
      localEditRevision += 1;
      syncedSnapshot = undefined;
    };

    const setStore = ((...args: unknown[]) => {
      markLocalEdit();
      (setRawStore as LooseStoreSetter)(...args);
    }) as SetStoreFunction<TData>;

    const serialized = createMemo(() => JSON.stringify(store));
    const runner = createAutosaveRunner<string>({
      ...autosave,
      readSnapshot: serialized,
      save: async (snapshot, signal) => {
        storage.setItem(key, snapshot);
        await saveRemote(JSON.parse(snapshot) as TData, signal);
      },
    });
    createEffect(
      on(
        serialized,
        (snapshot) => {
          if (snapshot !== syncedSnapshot) {
            runner.schedule(snapshot);
          }
        },
        { defer: true },
      ),
    );
    onCleanup(runner.dispose);

    const normalizeData = (data: TData): TData =>
      normalize === undefined ? data : normalize(data as Record<string, unknown>);

    const applyRemoteData = (data: TData): void => {
      let appliedSnapshot = '';
      batch(() => {
        setRawStore(reconcile(data));
        appliedSnapshot = untrack(serialized);
        syncedSnapshot = appliedSnapshot;
      });
      storage.setItem(key, appliedSnapshot);
    };

    let hasInitialized = false;
    let initInFlight: Promise<void> | undefined;
    let initController: AbortController | undefined;

    const loadRemoteData = async (signal: AbortSignal): Promise<void> => {
      const revisionAtStart = localEditRevision;
      const remote = await fetchRemote(signal);
      signal.throwIfAborted();
      if (remote === null || remote === undefined) {
        return;
      }
      const next = normalizeData(remote);
      if (localEditRevision === revisionAtStart) {
        applyRemoteData(next);
      }
    };

    const init = (): Promise<void> => {
      if (hasInitialized) {
        return Promise.resolve();
      }
      if (initInFlight !== undefined) {
        return initInFlight;
      }
      const controller = new AbortController();
      initController = controller;
      const attempt = loadRemoteData(controller.signal).then(() => {
        hasInitialized = true;
      });
      const tracked: Promise<void> = attempt.finally(() => {
        if (initInFlight === tracked) {
          initInFlight = undefined;
          initController = undefined;
        }
      });
      initInFlight = tracked;
      return tracked;
    };

    return {
      store,
      setStore,
      saveStatus: runner.status,
      error: runner.error,
      init,
      flush: runner.flush,
      importData: (data) => {
        const next = normalizeData(data);
        markLocalEdit();
        setRawStore(reconcile(next));
      },
      collectionActions: <TItem extends { id: string }>(collectionKey: keyof TData & string) =>
        createStoreCollectionActions<TItem>(setStore, collectionKey),
      dispose: () => {
        initController?.abort();
        disposeRoot();
      },
    };
  });
};
