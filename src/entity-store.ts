import { type Accessor, createMemo, createSignal } from 'solid-js';

export interface CreateEntityStoreOptions<T, Id extends PropertyKey> {
  getId: (item: T) => Id;
  initialItems?: T[];
}

export interface EntityStore<T, Id extends PropertyKey> {
  ids: Accessor<Id[]>;
  entities: Accessor<ReadonlyMap<Id, T>>;
  list: Accessor<T[]>;
  getById(id: Id): T | undefined;
  setAll(items: T[]): void;
  upsert(item: T): void;
  remove(id: Id): void;
  clear(): void;
}

export const createEntityStore = <T, Id extends PropertyKey>(
  options: CreateEntityStoreOptions<T, Id>,
): EntityStore<T, Id> => {
  const initialEntities = new Map<Id, T>();
  for (const item of options.initialItems ?? []) initialEntities.set(options.getId(item), item);
  const [entities, setEntities] = createSignal<ReadonlyMap<Id, T>>(initialEntities);
  const setAll = (items: T[]): void => {
    const next = new Map<Id, T>();
    for (const item of items) next.set(options.getId(item), item);
    setEntities(next);
  };
  const ids = createMemo(() => [...entities().keys()]);
  const list = createMemo(() => [...entities().values()]);
  return {
    ids,
    entities,
    list,
    getById: (id) => entities().get(id),
    setAll,
    upsert: (item) => {
      const next = new Map(entities());
      next.set(options.getId(item), item);
      setEntities(next);
    },
    remove: (id) => {
      if (!entities().has(id)) return;
      const next = new Map(entities());
      next.delete(id);
      setEntities(next);
    },
    clear: () => setEntities(new Map()),
  };
};
