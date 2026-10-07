export type Updater<TValue, TPrevious = TValue> = TValue | ((previous: TPrevious) => TValue);

const isUpdaterFunction = <TValue, TPrevious>(
  updater: Updater<TValue, TPrevious>,
): updater is (previous: TPrevious) => TValue => typeof updater === 'function';

export const applyUpdater = <TValue, TPrevious>(updater: Updater<TValue, TPrevious>, previous: TPrevious): TValue =>
  isUpdaterFunction(updater) ? updater(previous) : updater;
