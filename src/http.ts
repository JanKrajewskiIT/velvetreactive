import { getReactiveRuntimeConfig } from './runtime.js';

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

export class ApiError extends Error {
  readonly status: number;
  readonly url: string;
  readonly details: unknown;

  constructor(message: string, options: { status: number; url: string; details?: unknown }) {
    super(message);
    this.name = 'ApiError';
    this.status = options.status;
    this.url = options.url;
    this.details = options.details;
  }
}

const isAbsoluteUrl = (value: string): boolean => /^https?:\/\//iu.test(value);
const trimTrailingSlashes = (value: string): string => value.replace(/\/+$/u, '');
const trimLeadingSlashes = (value: string): string => value.replace(/^\/+/u, '');

export const buildUrl = (baseUrl: string, path: string, query?: Record<string, HttpQueryValue>): string => {
  const absolute = isAbsoluteUrl(baseUrl);
  const base = new URL(baseUrl || '/', 'http://reactive.invalid');
  const request = new URL(path || '', 'http://reactive.invalid');
  const joinedPath = `${trimTrailingSlashes(base.pathname)}/${trimLeadingSlashes(request.pathname)}`;
  const result = absolute ? new URL(base.toString()) : new URL(joinedPath, 'http://reactive.invalid');
  result.pathname = joinedPath;
  result.search = request.search;
  result.hash = request.hash;

  if (query !== undefined) {
    for (const [key, value] of Object.entries(query)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item !== null && item !== undefined) result.searchParams.append(key, String(item));
        }
      } else if (value !== null && value !== undefined) {
        result.searchParams.set(key, String(value));
      }
    }
  }

  return absolute ? result.toString() : `${result.pathname}${result.search}`;
};

export const resolveRequestBody = (body: unknown): { body: BodyInit | undefined; contentType: string | undefined } => {
  if (body === undefined || body === null) return { body: undefined, contentType: undefined };
  if (body instanceof FormData || body instanceof URLSearchParams || body instanceof Blob || typeof body === 'string') {
    return { body, contentType: undefined };
  }
  return { body: JSON.stringify(body), contentType: 'application/json' };
};

export const parseResponseBody = async (response: Response): Promise<unknown> => {
  if (response.status === 204) return undefined;
  const contentType = response.headers.get('content-type') ?? '';
  return contentType.includes('application/json') ? response.json() : response.text();
};

export const normalizeHttpError = (value: unknown, fallback = 'Request failed'): Error =>
  value instanceof Error ? value : new Error(fallback);

export const createHttpClient = (config: HttpClientConfig = {}): HttpClient => {
  const fetchImplementation = config.fetch ?? globalThis.fetch;
  const baseUrl = config.baseUrl ?? '';

  const request = async <T>(method: string, path: string, options: HttpRequestOptions = {}): Promise<T> => {
    const token = await getReactiveRuntimeConfig().getAccessToken?.();
    const resolvedBody = resolveRequestBody(options.body);
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(resolvedBody.contentType === undefined ? {} : { 'Content-Type': resolvedBody.contentType }),
      ...config.headers,
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    const url = buildUrl(baseUrl, path, options.query);
    let init: RequestInit = {
      method,
      headers,
      ...(resolvedBody.body === undefined ? {} : { body: resolvedBody.body }),
      ...(options.signal === undefined ? {} : { signal: options.signal }),
    };

    for (const interceptor of config.requestInterceptors ?? []) init = await interceptor(url, init);
    let response = await fetchImplementation(url, init);
    for (const interceptor of config.responseInterceptors ?? []) response = await interceptor(response, url);
    const data = await parseResponseBody(response);

    if (!response.ok) {
      if (response.status === 401) await config.onUnauthorized?.();
      const responseMessage =
        typeof data === 'object' && data !== null ? (data as Record<string, unknown>).message : undefined;
      const message = typeof responseMessage === 'string' ? responseMessage : `HTTP ${response.status}`;
      throw new ApiError(message, { status: response.status, url, details: data });
    }
    return data as T;
  };

  return {
    request,
    get: (path, options) => request('GET', path, options),
    post: (path, body, options) => request('POST', path, { ...options, body }),
    put: (path, body, options) => request('PUT', path, { ...options, body }),
    patch: (path, body, options) => request('PATCH', path, { ...options, body }),
    delete: (path, options) => request('DELETE', path, options),
  };
};

export type HttpClientMap<TClients extends Record<string, string>> = { [Key in keyof TClients]: HttpClient };
export type DefaultApiClientMap = { api: '/' };

export interface CreateApiClientsOptions<TClients extends Record<string, string> = DefaultApiClientMap> extends Omit<
  HttpClientConfig,
  'baseUrl'
> {
  baseUrl: string;
  clients?: TClients;
  isDev?: boolean;
  devProxyPath?: string;
}

export const createApiClients = <TClients extends Record<string, string> = DefaultApiClientMap>(
  options: CreateApiClientsOptions<TClients>,
): HttpClientMap<TClients> => {
  const { baseUrl, clients, isDev, devProxyPath, ...clientConfig } = options;
  const trimmedBase = baseUrl.trim();
  const effectiveBase = isDev === true && trimmedBase === '' ? (devProxyPath ?? '/api') : trimmedBase;
  const definitions = (clients ?? { api: '/' }) as TClients;
  const result = {} as HttpClientMap<TClients>;

  for (const [key, path] of Object.entries(definitions)) {
    const clientBase = `${trimTrailingSlashes(effectiveBase)}/${trimLeadingSlashes(path)}`;
    result[key as keyof TClients] = createHttpClient({ ...clientConfig, baseUrl: clientBase });
  }
  return result;
};

const priorityCollectionKeys = ['items', 'Items', 'data', 'Data', 'results', 'Results', 'value', 'Value', '$values'];

export const unwrapCollectionResponse = <T>(input: object | T[] | string | null | undefined): T[] => {
  const visited = new Set<object>();
  const find = (value: unknown, depth: number): T[] | undefined => {
    if (Array.isArray(value)) return value as T[];
    if (typeof value === 'string') {
      try {
        return find(JSON.parse(value) as unknown, depth);
      } catch {
        return [];
      }
    }
    if (value === null || typeof value !== 'object' || depth >= 3 || visited.has(value)) return undefined;
    visited.add(value);
    const record = value as Record<string, unknown>;

    for (const key of priorityCollectionKeys) {
      if (!(key in record)) continue;
      const direct = record[key];
      if (Array.isArray(direct)) return direct as T[];
      const nested = find(direct, depth + 1);
      if (nested !== undefined && nested.length > 0) return nested;
    }
    for (const candidate of Object.values(record)) if (Array.isArray(candidate)) return candidate as T[];
    for (const candidate of Object.values(record)) {
      if (candidate !== null && typeof candidate === 'object') {
        const nested = find(candidate, depth + 1);
        if (nested !== undefined && nested.length > 0) return nested;
      }
    }
    return undefined;
  };
  return find(input, 0) ?? [];
};
