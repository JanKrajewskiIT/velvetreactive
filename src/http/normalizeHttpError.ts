import { toError } from '../shared/toError.js';

const DEFAULT_FALLBACK_MESSAGE = 'Request failed';

export const normalizeHttpError = (error: unknown, fallback: string = DEFAULT_FALLBACK_MESSAGE): Error =>
  toError(error, fallback);
