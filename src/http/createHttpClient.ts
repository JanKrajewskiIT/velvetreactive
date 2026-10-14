import { getReactiveRuntimeConfig } from '../runtime/runtimeConfig.js';
import { ApiError } from './ApiError.js';
import { buildUrl } from './buildUrl.js';
import { JSON_CONTENT_TYPE } from './contentTypes.js';
import type { HttpBodylessRequestOptions, HttpClient, HttpClientConfig, HttpRequestOptions } from './httpTypes.js';
import { parseResponseBody } from './parseResponseBody.js';
import { resolveRequestBody } from './resolveRequestBody.js';

const BEARER_SCHEME = 'Bearer';
const UNAUTHORIZED_STATUS = 401;

const buildHeaders = (
  contentType: string | undefined,
  clientHeaders: Record<string, string> | undefined,
  requestHeaders: Record<string, string> | undefined,
  accessToken: string | undefined,
): Record<string, string> => {
  const headers: Record<string, string> = { Accept: JSON_CONTENT_TYPE };
  if (contentType !== undefined) {
    headers['Content-Type'] = contentType;
  }
  Object.assign(headers, clientHeaders, requestHeaders);
  if (accessToken) {
    headers['Authorization'] = `${BEARER_SCHEME} ${accessToken}`;
  }
  return headers;
};

const describeFailure = (status: number, details: unknown): string =>
  typeof details === 'object' && details !== null && 'message' in details && typeof details.message === 'string'
    ? details.message
    : `HTTP ${status}`;

export const createHttpClient = (config: HttpClientConfig = {}): HttpClient => {
  const fetchImplementation = config.fetch ?? globalThis.fetch;
  const baseUrl = config.baseUrl ?? '';

  const request = async <T>(method: string, path: string, options: HttpRequestOptions = {}): Promise<T> => {
    const accessToken = await getReactiveRuntimeConfig().getAccessToken?.();
    const url = buildUrl(baseUrl, path, options.query);
    const { body, contentType } = resolveRequestBody(options.body);

    let init: RequestInit = {
      method,
      headers: buildHeaders(contentType, config.headers, options.headers, accessToken),
    };
    if (body !== undefined) {
      init.body = body;
    }
    if (options.signal !== undefined) {
      init.signal = options.signal;
    }
    for (const interceptor of config.requestInterceptors ?? []) {
      init = await interceptor(url, init);
    }

    let response: Response;
    try {
      response = await fetchImplementation(url, init);
    } catch (error) {
      if (options.signal?.aborted || (error instanceof Error && error.name === 'AbortError')) throw error;
      throw new ApiError('Network request failed', { status: 0, url, cause: error });
    }
    for (const interceptor of config.responseInterceptors ?? []) {
      response = await interceptor(response, url);
    }

    const details = await parseResponseBody(response);
    if (!response.ok) {
      if (response.status === UNAUTHORIZED_STATUS) {
        await config.onUnauthorized?.();
      }
      throw new ApiError(describeFailure(response.status, details), { status: response.status, url, details });
    }
    return details as T;
  };

  const withBody =
    (method: string) =>
    <T>(path: string, body?: unknown, options?: HttpBodylessRequestOptions): Promise<T> =>
      request<T>(method, path, { ...options, body });
  const withoutBody =
    (method: string) =>
    <T>(path: string, options?: HttpBodylessRequestOptions): Promise<T> =>
      request<T>(method, path, options);

  return {
    request,
    get: withoutBody('GET'),
    post: withBody('POST'),
    put: withBody('PUT'),
    patch: withBody('PATCH'),
    delete: withoutBody('DELETE'),
  };
};
