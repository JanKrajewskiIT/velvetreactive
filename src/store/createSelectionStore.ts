import { type Accessor, createMemo, createSignal } from 'solid-js';

export interface SelectionStore<TId = string, TSort = string> {
  selectedId: Accessor<TId | null>;
  filter: Accessor<string>;
  sortBy: Accessor<TSort | null>;
  hasSelection: Accessor<boolean>;
  setSelectedId: (id: TId | null) => void;
  setFilter: (value: string) => void;
  setSortBy: (value: TSort | null) => void;
  clear: () => void;
}

export interface CreateSelectionStoreOptions<TId = string, TSort = string> {
  initialSelectedId?: TId | null;
  initialFilter?: string;
  initialSortBy?: TSort | null;
}

export const createSelectionStore = <TId = string, TSort = string>(
  options: CreateSelectionStoreOptions<TId, TSort> = {},
): SelectionStore<TId, TSort> => {
  const [selectedId, setSelectedId] = createSignal<TId | null>((options.initialSelectedId ?? null) as TId | null);
  const [filter, setFilter] = createSignal(options.initialFilter ?? '');
  const [sortBy, setSortBy] = createSignal<TSort | null>((options.initialSortBy ?? null) as TSort | null);

  const hasSelection = createMemo(() => selectedId() !== null);

  const clear = () => {
    setSelectedId(() => null);
    setFilter('');
    setSortBy(() => null);
  };

  return {
    selectedId,
    filter,
    sortBy,
    hasSelection,
    setSelectedId,
    setFilter,
    setSortBy,
    clear,
  };
};
