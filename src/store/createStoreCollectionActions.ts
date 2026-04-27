import { produce, reconcile } from 'solid-js/store';

export interface StoreCollectionActions<TItem> {
  add: (item: TItem) => void;
  update: (item: TItem) => void;
  remove: (id: string) => void;
}

export const createStoreCollectionActions = <TItem extends { id: string }>(
  setStore: (...args: never[]) => void,
  key: string,
): StoreCollectionActions<TItem> => {
  const apply = setStore as (...args: unknown[]) => void;

  return {
    add: (item: TItem) => {
      apply(
        key,
        produce((list: TItem[]) => {
          list.push(item);
        }),
      );
    },
    update: (item: TItem) => {
      apply(key, (value: TItem) => value.id === item.id, reconcile(item));
    },
    remove: (id: string) => {
      apply(key, (list: TItem[]) => list.filter((i) => i.id !== id));
    },
  };
};
