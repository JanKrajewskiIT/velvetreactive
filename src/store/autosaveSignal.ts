import type { Accessor } from 'solid-js';
import { createEffect, createMemo, on, onCleanup } from 'solid-js';

import { assertOwner } from '../shared/assertOwner.js';
import type { AutosaveStatus } from './autosaveRunner.js';
import { createAutosaveRunner } from './autosaveRunner.js';

export interface CreateAutosaveSignalOptions<TData> {
  source: Accessor<TData>;
  save: (data: TData, signal: AbortSignal) => Promise<void>;
  delayMs?: number;
  saveFeedbackMs?: number;
}

export interface AutosaveSignal {
  status: Accessor<AutosaveStatus>;
  error: Accessor<Error | undefined>;
  isSaving: Accessor<boolean>;
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
    flush: runner.flush,
  };
};
