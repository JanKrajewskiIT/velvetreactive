import { toError } from './toError.js';

const ABORTED_MESSAGE = 'The operation was aborted.';

export const createAbortError = (message: string): DOMException => new DOMException(message, 'AbortError');

export const abortableDelay = (durationMs: number, signal: AbortSignal): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(toError(signal.reason, ABORTED_MESSAGE));
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, durationMs);
    const onAbort = () => {
      clearTimeout(timer);
      reject(toError(signal.reason, ABORTED_MESSAGE));
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
