export type HttpQueryPrimitive = string | number | boolean | null | undefined;
export type HttpQueryValue = HttpQueryPrimitive | HttpQueryPrimitive[];

export interface HttpRequestOptions {
  headers?: Record<string, string>;
  query?: Record<string, HttpQueryValue>;
  body?: unknown;
  signal?: AbortSignal | undefined;
}

export type HttpRequestInterceptor = (url: string, init: RequestInit) => RequestInit | Promise<RequestInit>;
export type HttpResponseInterceptor = (response: Response, url: string) => Response | Promise<Response>;

export interface HttpClientConfig {
  baseUrl?: string;
  headers?: Record<string, string>;
  fetch?: typeof fetch;
  onUnauthorized?: () => void | Promise<void>;
  requestInterceptors?: HttpRequestInterceptor[];
  responseInterceptors?: HttpResponseInterceptor[];
}

export type HttpBodylessRequestOptions = Omit<HttpRequestOptions, 'body'>;

export interface HttpClient {
  readonly request: <T>(method: string, path: string, options?: HttpRequestOptions) => Promise<T>;
  readonly get: <T>(path: string, options?: HttpBodylessRequestOptions) => Promise<T>;
  readonly post: <T>(path: string, body?: unknown, options?: HttpBodylessRequestOptions) => Promise<T>;
  readonly put: <T>(path: string, body?: unknown, options?: HttpBodylessRequestOptions) => Promise<T>;
  readonly patch: <T>(path: string, body?: unknown, options?: HttpBodylessRequestOptions) => Promise<T>;
  readonly delete: <T>(path: string, options?: HttpBodylessRequestOptions) => Promise<T>;
}
