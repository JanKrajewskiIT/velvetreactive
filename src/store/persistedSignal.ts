import type { Accessor } from 'solid-js';
import { createSignal, untrack } from 'solid-js';

import { getLocalStorage } from '../shared/getLocalStorage.js';
import { applyUpdater } from '../shared/updater.js';

export interface PersistStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem?: (key: string) => void;
}

export interface CreatePersistedSignalOptions<T> {
  storage?: PersistStorage;
  serialize?: (value: T) => string;
  deserialize?: (value: string) => T;
}

const readStoredText = (
  storage: PersistStorage | undefined,
  key: string,
): [string | null, PersistStorage | undefined] => {
  if (storage === undefined) {
    return [null, undefined];
  }
  try {
    return [storage.getItem(key), storage];
  } catch {
    // A failing read marks the storage as unusable for this signal; the initial value applies and writes are skipped.
    return [null, undefined];
  }
};

const removeStoredText = (storage: PersistStorage, key: string): void => {
  try {
    storage.removeItem?.(key);
  } catch {
    // Removal of malformed data is best effort; the initial value already replaces it.
  }
};

export const createPersistedSignal = <T>(
  key: string,
  initialValue: T,
  options: CreatePersistedSignalOptions<T> = {},
): [Accessor<T>, (next: T | ((previous: T) => T)) => void] => {
  const serialize = options.serialize ?? ((value: T) => JSON.stringify(value));
  const deserialize = options.deserialize ?? ((text: string) => JSON.parse(text) as T);
  const [text, storage] = readStoredText(options.storage ?? getLocalStorage(), key);

  const restore = (): T => {
    if (text === null || storage === undefined) {
      return initialValue;
    }
    try {
      return deserialize(text);
    } catch {
      removeStoredText(storage, key);
      return initialValue;
    }
  };

  const [value, setValue] = createSignal<T>(restore());

  return [
    value,
    (next) => {
      const resolved = applyUpdater(next, untrack(value));
      storage?.setItem(key, serialize(resolved));
      setValue(() => resolved);
    },
  ];
};
