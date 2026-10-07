export interface ApiErrorOptions {
  status: number;
  url: string;
  details?: unknown;
}

export class ApiError extends Error {
  readonly status: number;
  readonly url: string;
  readonly details: unknown;

  constructor(message: string, { status, url, details }: ApiErrorOptions) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.url = url;
    this.details = details;
  }
}
