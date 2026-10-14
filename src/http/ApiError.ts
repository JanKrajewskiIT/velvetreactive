export interface ApiErrorOptions {
  status: number;
  url: string;
  details?: unknown;
  cause?: unknown;
}

export class ApiError extends Error {
  readonly status: number;
  readonly url: string;
  readonly details: unknown;

  constructor(message: string, { status, url, details, cause }: ApiErrorOptions) {
    super(message, { cause });
    this.name = 'ApiError';
    this.status = status;
    this.url = url;
    this.details = details;
  }
}
