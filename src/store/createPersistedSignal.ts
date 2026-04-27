import { type Accessor, createSignal } from 'solid-js';

export interface PersistStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

export interface CreatePersistedSignalOptions<T> {
  storage?: PersistStorage;
  serialize?: (value: T) => string;
  deserialize?: (value: string) => T;
}

const getDefaultStorage = (): PersistStorage | undefined => {
  if (typeof globalThis === 'undefined') {
    return undefined;
  }

  if (!('localStorage' in globalThis)) {
    return undefined;
  }

  return globalThis.localStorage;
};

export const createPersistedSignal = <T>(
  key: string,
  initialValue: T,
  options: CreatePersistedSignalOptions<T> = {},
): [Accessor<T>, (next: T | ((previous: T) => T)) => void] => {
  const storage = options.storage ?? getDefaultStorage();
  const serialize = options.serialize ?? JSON.stringify;
  const deserialize = options.deserialize ?? ((value: string) => JSON.parse(value) as T);

  const restored = (() => {
    if (!storage) {
      return initialValue;
    }

    const raw = storage.getItem(key);
    if (raw === null) {
      return initialValue;
    }

    try {
      return deserialize(raw);
    } catch {
      return initialValue;
    }
  })();

  const [value, setValue] = createSignal<T>(restored);

  const setPersistedValue = (next: T | ((previous: T) => T)) => {
    setValue((previous) => {
      const resolved = typeof next === 'function' ? (next as (current: T) => T)(previous) : next;
      if (storage) {
        storage.setItem(key, serialize(resolved));
      }
      return resolved;
    });
  };

  return [value, setPersistedValue];
};
