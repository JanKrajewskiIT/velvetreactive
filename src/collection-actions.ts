import { reconcile } from 'solid-js/store';

export interface StoreCollectionActions<TItem> {
  add(item: TItem): void;
  update(item: TItem): void;
  remove(id: string): void;
}

type UntypedStoreSetter = (...args: unknown[]) => void;

export const createStoreCollectionActions = <TItem extends { id: string }>(
  setStore: (...args: never[]) => void,
  key: string,
): StoreCollectionActions<TItem> => {
  const setter = setStore as UntypedStoreSetter;
  return {
    add: (item) => setter(key, (items: TItem[]) => [...items, item]),
    update: (item) => setter(key, (candidate: TItem) => candidate.id === item.id, reconcile(item)),
    remove: (id) => setter(key, (items: TItem[]) => items.filter((item) => item.id !== id)),
  };
};
