import { abortableDelay } from '../shared/abort.js';
import { toError } from '../shared/toError.js';
import type { QueryRetry, QueryRetryDelay } from './queryTypes.js';

export interface QueryRequest<TData> {
  load: (signal: AbortSignal) => Promise<TData>;
  retry: QueryRetry;
  retryDelay: QueryRetryDelay;
}

const shouldRetry = (retry: QueryRetry, attempt: number, error: Error): boolean =>
  typeof retry === 'function' ? retry(attempt, error) : attempt <= retry;

const resolveRetryDelay = (retryDelay: QueryRetryDelay, attempt: number): number =>
  typeof retryDelay === 'function' ? retryDelay(attempt) : retryDelay;

export const runWithRetry = async <TData>(
  { load, retry, retryDelay }: QueryRequest<TData>,
  signal: AbortSignal,
): Promise<TData> => {
  for (let attempt = 1; ; attempt += 1) {
    signal.throwIfAborted();
    try {
      return await load(signal);
    } catch (thrown) {
      if (signal.aborted) {
        throw thrown;
      }
      const error = toError(thrown, 'Query failed');
      if (!shouldRetry(retry, attempt, error)) {
        throw error;
      }
      const delayMs = resolveRetryDelay(retryDelay, attempt);
      if (delayMs > 0) {
        await abortableDelay(delayMs, signal);
      }
    }
  }
};
