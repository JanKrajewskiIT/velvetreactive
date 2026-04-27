export type HttpQueryPrimitive = string | number | boolean | null | undefined;
export type HttpQueryValue = HttpQueryPrimitive | HttpQueryPrimitive[];

export interface HttpRequestOptions {
  headers?: Record<string, string>;
  query?: Record<string, HttpQueryValue>;
  body?: unknown;
  signal?: AbortSignal;
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

export interface HttpClient {
  request<T>(method: string, path: string, options?: HttpRequestOptions): Promise<T>;
  get<T>(path: string, options?: Omit<HttpRequestOptions, 'body'>): Promise<T>;
  post<T>(path: string, body?: unknown, options?: Omit<HttpRequestOptions, 'body'>): Promise<T>;
  put<T>(path: string, body?: unknown, options?: Omit<HttpRequestOptions, 'body'>): Promise<T>;
  patch<T>(path: string, body?: unknown, options?: Omit<HttpRequestOptions, 'body'>): Promise<T>;
  delete<T>(path: string, options?: Omit<HttpRequestOptions, 'body'>): Promise<T>;
}
