import { type Accessor, createSignal } from 'solid-js';

export interface CreateSelectionStoreOptions<TId = string, TSort = string> {
  initialSelectedId?: TId | null;
  initialFilter?: string;
  initialSortBy?: TSort | null;
}

export interface SelectionStore<TId = string, TSort = string> {
  selectedId: Accessor<TId | null>;
  filter: Accessor<string>;
  sortBy: Accessor<TSort | null>;
  hasSelection: Accessor<boolean>;
  setSelectedId(id: TId | null): void;
  setFilter(value: string): void;
  setSortBy(value: TSort | null): void;
  clear(): void;
}

export const createSelectionStore = <TId = string, TSort = string>(
  options: CreateSelectionStoreOptions<TId, TSort> = {},
): SelectionStore<TId, TSort> => {
  const [selectedId, setSelectedId] = createSignal<TId | null>(options.initialSelectedId ?? null);
  const [filter, setFilter] = createSignal(options.initialFilter ?? '');
  const [sortBy, setSortBy] = createSignal<TSort | null>(options.initialSortBy ?? null);
  return {
    selectedId,
    filter,
    sortBy,
    hasSelection: () => selectedId() !== null,
    setSelectedId: (id) => setSelectedId(() => id),
    setFilter,
    setSortBy: (value) => setSortBy(() => value),
    clear: () => {
      setSelectedId(null);
      setFilter('');
      setSortBy(null);
    },
  };
};
