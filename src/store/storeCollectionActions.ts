import { reconcile } from 'solid-js/store';

export interface StoreCollectionActions<TItem> {
  add: (item: TItem) => void;
  update: (item: TItem) => void;
  remove: (id: string) => void;
}

type LooseStoreSetter = (...args: unknown[]) => void;

export const createStoreCollectionActions = <TItem extends { id: string }>(
  setStore: (...args: never[]) => void,
  key: string,
): StoreCollectionActions<TItem> => {
  const setCollection = setStore as LooseStoreSetter;

  return {
    add: (item) => {
      setCollection(key, (items: TItem[]) => [...items, item]);
    },
    update: (item) => {
      setCollection(key, (entry: TItem) => entry.id === item.id, reconcile(item));
    },
    remove: (id) => {
      setCollection(key, (items: TItem[]) =>
        items.some((entry) => entry.id === id) ? items.filter((entry) => entry.id !== id) : items,
      );
    },
  };
};
