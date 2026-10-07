import type { Accessor } from 'solid-js';
import { batch, createSignal } from 'solid-js';

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
  setSelectedId: (id: TId | null) => void;
  setFilter: (value: string) => void;
  setSortBy: (value: TSort | null) => void;
  clear: () => void;
}

const EMPTY_FILTER = '';

export const createSelectionStore = <TId = string, TSort = string>({
  initialSelectedId,
  initialFilter,
  initialSortBy,
}: CreateSelectionStoreOptions<TId, TSort> = {}): SelectionStore<TId, TSort> => {
  const [selectedId, setSelectedIdValue] = createSignal<TId | null>(initialSelectedId ?? null);
  const [filter, setFilterValue] = createSignal(initialFilter ?? EMPTY_FILTER);
  const [sortBy, setSortByValue] = createSignal<TSort | null>(initialSortBy ?? null);

  return {
    selectedId,
    filter,
    sortBy,
    hasSelection: () => selectedId() !== null,
    setSelectedId: (id) => {
      setSelectedIdValue(() => id);
    },
    setFilter: (value) => {
      setFilterValue(value);
    },
    setSortBy: (value) => {
      setSortByValue(() => value);
    },
    clear: () => {
      batch(() => {
        setSelectedIdValue(null);
        setFilterValue(EMPTY_FILTER);
        setSortByValue(null);
      });
    },
  };
};
