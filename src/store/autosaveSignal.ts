import type { Accessor } from 'solid-js';
import { createEffect, createMemo, on, onCleanup } from 'solid-js';

import { assertOwner } from '../shared/assertOwner.js';
import type { AutosaveRunnerOptions, AutosaveStatus } from './autosaveRunner.js';
import { createAutosaveRunner } from './autosaveRunner.js';

export interface CreateAutosaveSignalOptions<TData> extends Omit<AutosaveRunnerOptions<TData>, 'readSnapshot'> {
  source: Accessor<TData>;
}

export interface AutosaveSignal {
  status: Accessor<AutosaveStatus>;
  error: Accessor<Error | undefined>;
  isSaving: Accessor<boolean>;
  dirty: Accessor<boolean>;
  persistenceError: Accessor<Error | undefined>;
  flush: () => Promise<void>;
}

export const createAutosaveSignal = <TData>({
  source,
  ...runnerOptions
}: CreateAutosaveSignalOptions<TData>): AutosaveSignal => {
  assertOwner('createAutosaveSignal');
  const runner = createAutosaveRunner({ ...runnerOptions, readSnapshot: source });
  const snapshot = createMemo(source);

  createEffect(on(snapshot, runner.schedule, { defer: true }));
  onCleanup(runner.dispose);

  return {
    status: runner.status,
    error: runner.error,
    isSaving: () => runner.status() === 'saving',
    dirty: runner.dirty,
    persistenceError: runner.persistenceError,
    flush: runner.flush,
  };
};
