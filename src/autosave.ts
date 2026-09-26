import { type Accessor, createEffect, createSignal, on, onCleanup } from 'solid-js';

const noSkippedValue = Symbol('no-skipped-autosave-value');

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

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
  flush(): Promise<void>;
}

export interface AutosaveController extends AutosaveSignal {
  dispose(): void;
  skipNextChange(expectedValue: unknown): void;
}

export const createAutosaveController = <TData>(options: CreateAutosaveSignalOptions<TData>): AutosaveController => {
  const delayMs = options.delayMs ?? 500;
  const saveFeedbackMs = options.saveFeedbackMs ?? 3000;
  const [status, setStatus] = createSignal<AutosaveStatus>('idle');
  const [error, setError] = createSignal<Error>();
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  let feedbackTimer: ReturnType<typeof setTimeout> | undefined;
  let activeController: AbortController | undefined;
  let disposed = false;
  let skippedValue: unknown = noSkippedValue;

  const clearDebounce = (): void => {
    if (debounceTimer !== undefined) clearTimeout(debounceTimer);
    debounceTimer = undefined;
  };

  const clearFeedback = (): void => {
    if (feedbackTimer !== undefined) clearTimeout(feedbackTimer);
    feedbackTimer = undefined;
  };

  const saveSnapshot = async (snapshot: TData): Promise<void> => {
    if (disposed) return;
    clearFeedback();
    activeController?.abort();
    const controller = new AbortController();
    const isInactive = (): boolean => controller.signal.aborted || disposed;
    activeController = controller;
    setStatus('saving');
    setError(undefined);
    try {
      await options.save(snapshot, controller.signal);
      if (isInactive()) return;
      setStatus('saved');
      feedbackTimer = setTimeout(() => {
        if (!controller.signal.aborted && status() === 'saved' && !disposed) setStatus('idle');
      }, saveFeedbackMs);
    } catch (reason) {
      if (isInactive()) return;
      setError(reason instanceof Error ? reason : new Error('Autosave failed'));
      setStatus('error');
    } finally {
      if (activeController === controller) activeController = undefined;
    }
  };

  createEffect(
    on(
      options.source,
      (snapshot) => {
        if (Object.is(snapshot, skippedValue)) {
          skippedValue = noSkippedValue;
          return;
        }
        skippedValue = noSkippedValue;
        clearDebounce();
        debounceTimer = setTimeout(() => {
          debounceTimer = undefined;
          void saveSnapshot(snapshot);
        }, delayMs);
      },
      { defer: true },
    ),
  );

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    clearDebounce();
    clearFeedback();
    activeController?.abort();
    activeController = undefined;
  };
  onCleanup(dispose);

  return {
    status,
    error,
    isSaving: () => status() === 'saving',
    flush: async () => {
      clearDebounce();
      const snapshot = options.source();
      await saveSnapshot(snapshot);
    },
    dispose,
    skipNextChange: (expectedValue) => {
      skippedValue = expectedValue;
    },
  };
};

export const createAutosaveSignal = <TData>(options: CreateAutosaveSignalOptions<TData>): AutosaveSignal =>
  createAutosaveController(options);
