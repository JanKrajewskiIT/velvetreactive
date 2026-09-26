import { type Accessor, createSignal } from 'solid-js';

export interface PersistStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface CreatePersistedSignalOptions<T> {
  storage?: PersistStorage;
  serialize?: (value: T) => string;
  deserialize?: (value: string) => T;
}

interface RemovablePersistStorage extends PersistStorage {
  removeItem(key: string): void;
}

export const createPersistedSignal = <T>(
  key: string,
  initialValue: T,
  options: CreatePersistedSignalOptions<T> = {},
): [Accessor<T>, (next: T | ((previous: T) => T)) => void] => {
  let storage = options.storage ?? ('localStorage' in globalThis ? globalThis.localStorage : undefined);
  const serialize = options.serialize ?? JSON.stringify;
  const deserialize = options.deserialize ?? ((value: string) => JSON.parse(value) as T);
  let restored = initialValue;

  if (storage !== undefined) {
    let stored: string | null;
    try {
      stored = storage.getItem(key);
    } catch {
      storage = undefined;
      stored = null;
    }
    if (stored !== null) {
      try {
        restored = deserialize(stored);
      } catch {
        const removable = storage as Partial<RemovablePersistStorage>;
        try {
          removable.removeItem?.(key);
        } catch {
          // Best-effort cleanup must not prevent fallback to the initial value.
        }
      }
    }
  }

  const [value, setValue] = createSignal(restored);
  const setPersistedValue = (next: T | ((previous: T) => T)): void => {
    const previous = value();
    const resolved = typeof next === 'function' ? (next as (previous: T) => T)(previous) : next;
    if (storage !== undefined) storage.setItem(key, serialize(resolved));
    setValue(() => resolved);
  };
  return [value, setPersistedValue];
};
