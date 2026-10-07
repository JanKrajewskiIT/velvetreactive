import type { Accessor } from 'solid-js';
import { createMemo, createSignal } from 'solid-js';

export interface CreateEntityStoreOptions<T, Id extends PropertyKey> {
  getId: (item: T) => Id;
  initialItems?: T[];
}

export interface EntityStore<T, Id extends PropertyKey> {
  ids: Accessor<Id[]>;
  entities: Accessor<ReadonlyMap<Id, T>>;
  list: Accessor<T[]>;
  getById: (id: Id) => T | undefined;
  setAll: (items: T[]) => void;
  upsert: (item: T) => void;
  remove: (id: Id) => void;
  clear: () => void;
}

export const createEntityStore = <T, Id extends PropertyKey>({
  getId,
  initialItems = [],
}: CreateEntityStoreOptions<T, Id>): EntityStore<T, Id> => {
  const toEntityMap = (items: readonly T[]): ReadonlyMap<Id, T> =>
    new Map(items.map((item): [Id, T] => [getId(item), item]));

  const [entities, setEntities] = createSignal<ReadonlyMap<Id, T>>(toEntityMap(initialItems));
  const ids = createMemo(() => [...entities().keys()]);
  const list = createMemo(() => [...entities().values()]);

  return {
    ids,
    entities,
    list,
    getById: (id) => entities().get(id),
    setAll: (items) => {
      setEntities(toEntityMap(items));
    },
    upsert: (item) => {
      setEntities((current) => new Map(current).set(getId(item), item));
    },
    remove: (id) => {
      setEntities((current) => {
        if (!current.has(id)) {
          return current;
        }
        const next = new Map(current);
        next.delete(id);
        return next;
      });
    },
    clear: () => {
      setEntities(new Map());
    },
  };
};
