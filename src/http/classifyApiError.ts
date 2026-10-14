import { ApiError } from './ApiError.js';

export type ApiFailureKind =
  'cancelled' | 'network' | 'unauthorized' | 'forbidden' | 'validation' | 'conflict' | 'transient' | 'unknown';

export const classifyApiError = (error: unknown): ApiFailureKind => {
  if (error instanceof Error && error.name === 'AbortError') return 'cancelled';
  if (error instanceof ApiError) {
    if (error.status === 401) return 'unauthorized';
    if (error.status === 403) return 'forbidden';
    if (error.status === 409 || error.status === 412) return 'conflict';
    if (error.status === 400 || error.status === 422) return 'validation';
    if ([408, 425, 429, 500, 502, 503, 504].includes(error.status)) return 'transient';
    if (error.status === 0) return 'network';
  }
  return 'unknown';
};

export const isRetryableApiError = (error: unknown): boolean => {
  const kind = classifyApiError(error);
  return kind === 'network' || kind === 'transient';
};
