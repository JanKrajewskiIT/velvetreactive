export class ApiError extends Error {
  status: number;
  url: string;
  details: unknown;

  constructor(message: string, options: { status: number; url: string; details?: unknown }) {
    super(message);
    this.name = 'ApiError';
    this.status = options.status;
    this.url = options.url;
    this.details = options.details;
  }
}

export const normalizeHttpError = (error: unknown, fallback = 'Request failed'): Error => {
  if (error instanceof Error) {
    return error;
  }

  return new Error(fallback);
};
