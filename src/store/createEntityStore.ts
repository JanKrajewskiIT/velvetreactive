import { type Accessor, createMemo, createSignal } from 'solid-js';

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

export interface CreateEntityStoreOptions<T, Id extends PropertyKey> {
  getId: (item: T) => Id;
  initialItems?: T[];
}

export const createEntityStore = <T, Id extends PropertyKey>(
  options: CreateEntityStoreOptions<T, Id>,
): EntityStore<T, Id> => {
  const [entities, setEntities] = createSignal(new Map<Id, T>());

  const ids: Accessor<Id[]> = createMemo(() => Array.from(entities().keys()));
  const list: Accessor<T[]> = createMemo(() => Array.from(entities().values()));

  const setAll = (items: T[]) => {
    const next = new Map<Id, T>();
    items.forEach((item) => {
      next.set(options.getId(item), item);
    });
    setEntities(next);
  };

  const upsert = (item: T) => {
    const id = options.getId(item);
    setEntities((previous) => {
      const next = new Map(previous);
      next.set(id, item);
      return next;
    });
  };

  const remove = (id: Id) => {
    setEntities((previous) => {
      if (!previous.has(id)) {
        return previous;
      }

      const next = new Map(previous);
      next.delete(id);
      return next;
    });
  };

  const clear = () => {
    setEntities(new Map<Id, T>());
  };

  const getById = (id: Id): T | undefined => entities().get(id);

  if (options.initialItems && options.initialItems.length > 0) {
    setAll(options.initialItems);
  }

  return {
    ids,
    entities,
    list,
    getById,
    setAll,
    upsert,
    remove,
    clear,
  };
};
