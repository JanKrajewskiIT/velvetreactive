import type { Accessor } from 'solid-js';
import { batch, createSignal, untrack } from 'solid-js';

import type { TimerHandle } from '../shared/timers.js';
import { toError } from '../shared/toError.js';

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface AutosaveRunnerOptions<TData> {
  readSnapshot: () => TData;
  save: (data: TData, signal: AbortSignal) => Promise<void>;
  delayMs?: number;
  saveFeedbackMs?: number;
}

export interface AutosaveRunner<TData> {
  readonly status: Accessor<AutosaveStatus>;
  readonly error: Accessor<Error | undefined>;
  readonly schedule: (snapshot: TData) => void;
  readonly flush: () => Promise<void>;
  readonly dispose: () => void;
}

export const DEFAULT_AUTOSAVE_DELAY_MS = 500;
export const DEFAULT_SAVE_FEEDBACK_MS = 3000;

export const createAutosaveRunner = <TData>({
  readSnapshot,
  save,
  delayMs = DEFAULT_AUTOSAVE_DELAY_MS,
  saveFeedbackMs = DEFAULT_SAVE_FEEDBACK_MS,
}: AutosaveRunnerOptions<TData>): AutosaveRunner<TData> => {
  const [status, setStatus] = createSignal<AutosaveStatus>('idle');
  const [error, setError] = createSignal<Error | undefined>(undefined);
  let debounceTimer: TimerHandle | undefined;
  let feedbackTimer: TimerHandle | undefined;
  let activeSave: AbortController | undefined;
  let isDisposed = false;

  const clearDebounce = (): void => {
    clearTimeout(debounceTimer);
    debounceTimer = undefined;
  };

  const clearFeedback = (): void => {
    clearTimeout(feedbackTimer);
    feedbackTimer = undefined;
  };

  const startSave = async (snapshot: TData): Promise<void> => {
    if (isDisposed) {
      return;
    }
    clearFeedback();
    activeSave?.abort();
    const controller = new AbortController();
    activeSave = controller;
    batch(() => {
      setStatus('saving');
      setError(undefined);
    });
    try {
      await save(snapshot, controller.signal);
    } catch (thrown) {
      if (!controller.signal.aborted) {
        batch(() => {
          setError(toError(thrown, 'Autosave failed'));
          setStatus('error');
        });
      }
      return;
    } finally {
      if (activeSave === controller) {
        activeSave = undefined;
      }
    }
    if (controller.signal.aborted) {
      return;
    }
    setStatus('saved');
    feedbackTimer = setTimeout(() => {
      feedbackTimer = undefined;
      setStatus('idle');
    }, saveFeedbackMs);
  };

  return {
    status,
    error,
    schedule: (snapshot) => {
      if (isDisposed) {
        return;
      }
      clearDebounce();
      debounceTimer = setTimeout(() => {
        debounceTimer = undefined;
        void startSave(snapshot);
      }, delayMs);
    },
    flush: async () => {
      clearDebounce();
      await startSave(untrack(readSnapshot));
    },
    dispose: () => {
      isDisposed = true;
      clearDebounce();
      clearFeedback();
      activeSave?.abort();
      activeSave = undefined;
    },
  };
};
