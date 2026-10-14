import type { Accessor } from 'solid-js';
import { batch, createSignal, untrack } from 'solid-js';

import { classifyApiError, isRetryableApiError } from '../http/classifyApiError.js';
import type { TimerHandle } from '../shared/timers.js';
import { MAX_TIMER_DELAY_MS } from '../shared/timers.js';
import { toError } from '../shared/toError.js';

export type AutosaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error' | 'offline' | 'conflict';

export interface AutosaveRunnerOptions<TData> {
  readSnapshot: () => TData;
  save: (data: TData, signal: AbortSignal) => Promise<void>;
  delayMs?: number;
  maxWaitMs?: number;
  saveFeedbackMs?: number;
  retry?: number;
  shouldRetry?: (error: Error) => boolean;
  persistSnapshot?: (data: TData) => void;
  clearSnapshot?: () => void;
}

export interface AutosaveRunner<TData> {
  readonly status: Accessor<AutosaveStatus>;
  readonly error: Accessor<Error | undefined>;
  readonly persistenceError: Accessor<Error | undefined>;
  readonly dirty: Accessor<boolean>;
  readonly schedule: (snapshot: TData) => void;
  readonly flush: () => Promise<void>;
  readonly dispose: () => void;
}

export const DEFAULT_AUTOSAVE_DELAY_MS = 500;
export const DEFAULT_SAVE_FEEDBACK_MS = 3000;
const DEFAULT_MAX_WAIT_MS = 5000;

export const createAutosaveRunner = <TData>({
  readSnapshot,
  save,
  delayMs = DEFAULT_AUTOSAVE_DELAY_MS,
  maxWaitMs = DEFAULT_MAX_WAIT_MS,
  saveFeedbackMs = DEFAULT_SAVE_FEEDBACK_MS,
  retry = 0,
  shouldRetry = isRetryableApiError,
  persistSnapshot,
  clearSnapshot,
}: AutosaveRunnerOptions<TData>): AutosaveRunner<TData> => {
  for (const [name, value] of Object.entries({ delayMs, maxWaitMs, saveFeedbackMs })) {
    if (!Number.isFinite(value) || value < 0 || value > MAX_TIMER_DELAY_MS) {
      throw new RangeError(`${name} must be a finite timer delay between 0 and ${MAX_TIMER_DELAY_MS}`);
    }
  }
  if (!Number.isInteger(retry) || retry < 0 || retry > 10)
    throw new RangeError('retry must be an integer between 0 and 10');
  const [status, setStatus] = createSignal<AutosaveStatus>('idle');
  const [error, setError] = createSignal<Error>();
  const [persistenceError, setPersistenceError] = createSignal<Error>();
  const [dirty, setDirty] = createSignal(false);
  let pending: { snapshot: TData; revision: number } | undefined;
  let revision = 0;
  let retries = 0;
  let debounceTimer: TimerHandle | undefined;
  let maxWaitTimer: TimerHandle | undefined;
  let feedbackTimer: TimerHandle | undefined;
  let retryTimer: TimerHandle | undefined;
  let activeSave: AbortController | undefined;
  let activePromise: Promise<void> | undefined;
  let disposed = false;
  let conflict = false;
  const isDisposed = (): boolean => disposed;
  const readPending = (): typeof pending => pending;

  const persist = (snapshot: TData): void => {
    try {
      persistSnapshot?.(snapshot);
      setPersistenceError(undefined);
    } catch (thrown) {
      setPersistenceError(toError(thrown, 'Local draft persistence failed'));
    }
  };
  const clearTimers = (): void => {
    clearTimeout(debounceTimer);
    clearTimeout(maxWaitTimer);
    clearTimeout(retryTimer);
    debounceTimer = maxWaitTimer = retryTimer = undefined;
  };
  const drain = async (): Promise<void> => {
    if (disposed) throw new DOMException('Autosave has been disposed', 'AbortError');
    if (activePromise) return activePromise;
    clearTimers();
    const execute = async (): Promise<void> => {
      while (pending && !disposed) {
        const submitted = pending;
        pending = undefined;
        const controller = new AbortController();
        activeSave = controller;
        batch(() => {
          setStatus('saving');
          setError(undefined);
        });
        try {
          await save(submitted.snapshot, controller.signal);
        } catch (thrown) {
          if (isDisposed()) throw thrown;
          const failure = toError(thrown, 'Autosave failed');
          pending = readPending() ?? submitted;
          const kind = classifyApiError(failure);
          conflict = kind === 'conflict';
          batch(() => {
            setError(failure);
            setStatus(kind === 'conflict' ? 'conflict' : kind === 'network' ? 'offline' : 'error');
          });
          if (!conflict && shouldRetry(failure) && retries < retry) {
            retries += 1;
            retryTimer = setTimeout(
              startScheduledSave,
              Math.min(1000 * 2 ** (retries - 1), 10_000) + Math.random() * 250,
            );
          }
          throw failure;
        } finally {
          activeSave = undefined;
        }
        if (isDisposed()) return;
        retries = 0;
        if (submitted.revision === revision) {
          batch(() => {
            setDirty(false);
            setStatus('saved');
          });
          try {
            clearSnapshot?.();
            setPersistenceError(undefined);
          } catch (thrown) {
            setPersistenceError(toError(thrown, 'Local draft cleanup failed'));
          }
          clearTimeout(feedbackTimer);
          feedbackTimer = setTimeout(() => {
            if (!dirty()) setStatus('idle');
          }, saveFeedbackMs);
        }
      }
    };
    activePromise = execute();
    try {
      await activePromise;
    } finally {
      activePromise = undefined;
    }
  };
  const startScheduledSave = (): void => {
    // The failure remains visible through error/status; scheduled work has no awaiting caller.
    void drain().catch(() => undefined);
  };
  return {
    status,
    error,
    persistenceError,
    dirty,
    schedule: (snapshot) => {
      if (disposed) return;
      revision += 1;
      pending = { snapshot, revision };
      persist(snapshot);
      if (conflict) {
        setDirty(true);
        return;
      }
      clearTimeout(feedbackTimer);
      clearTimeout(debounceTimer);
      clearTimeout(retryTimer);
      batch(() => {
        setDirty(true);
        if (!activeSave) setStatus('dirty');
      });
      debounceTimer = setTimeout(startScheduledSave, delayMs);
      maxWaitTimer ??= setTimeout(startScheduledSave, maxWaitMs);
    },
    flush: async () => {
      conflict = false;
      if (dirty() && !pending && !activePromise) pending = { snapshot: untrack(readSnapshot), revision };
      await drain();
    },
    dispose: () => {
      if (disposed) return;
      if (dirty()) persist(untrack(readSnapshot));
      disposed = true;
      clearTimers();
      clearTimeout(feedbackTimer);
      activeSave?.abort();
    },
  };
};
