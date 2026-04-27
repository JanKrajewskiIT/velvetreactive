import { type Accessor, createEffect, createMemo, createSignal, on, onCleanup } from 'solid-js';

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
  flush: () => Promise<void>;
}

export const createAutosaveSignal = <TData>(options: CreateAutosaveSignalOptions<TData>): AutosaveSignal => {
  const delayMs = options.delayMs ?? 500;
  const saveFeedbackMs = options.saveFeedbackMs ?? 3000;

  const [status, setStatus] = createSignal<AutosaveStatus>('idle');
  const [error, setError] = createSignal<Error | undefined>(undefined);

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  let feedbackTimer: ReturnType<typeof setTimeout> | undefined;
  let activeAbort: AbortController | undefined;

  const executeSave = async (snapshot: TData): Promise<void> => {
    activeAbort?.abort();
    const controller = new AbortController();
    activeAbort = controller;

    setStatus('saving');
    setError(undefined);

    try {
      await options.save(snapshot, controller.signal);

      if (controller.signal.aborted) {
        return;
      }

      setStatus('saved');

      if (feedbackTimer) {
        clearTimeout(feedbackTimer);
      }

      feedbackTimer = setTimeout(() => {
        setStatus('idle');
      }, saveFeedbackMs);
    } catch (unknownError) {
      if (controller.signal.aborted) {
        return;
      }

      const normalized = unknownError instanceof Error ? unknownError : new Error('Autosave failed');
      setError(normalized);
      setStatus('error');
    }
  };

  const flush = async (): Promise<void> => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = undefined;
    }

    await executeSave(options.source());
  };

  createEffect(
    on(
      options.source,
      (snapshot) => {
        if (debounceTimer) {
          clearTimeout(debounceTimer);
        }

        debounceTimer = setTimeout(() => {
          void executeSave(snapshot);
        }, delayMs);
      },
      { defer: true },
    ),
  );

  onCleanup(() => {
    activeAbort?.abort();

    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    if (feedbackTimer) {
      clearTimeout(feedbackTimer);
    }
  });

  const isSaving = createMemo(() => status() === 'saving');

  return {
    status,
    error,
    isSaving,
    flush,
  };
};
