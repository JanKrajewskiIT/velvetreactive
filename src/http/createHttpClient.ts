import { getReactiveRuntimeConfig } from '../runtime';
import { ApiError } from './errors';
import type { HttpClient, HttpClientConfig, HttpRequestOptions } from './types';
import { buildUrl, parseResponseBody, resolveRequestBody } from './utils';

export const createHttpClient = (config: HttpClientConfig = {}): HttpClient => {
  const fetchImpl = config.fetch ?? globalThis.fetch;
  const baseUrl = config.baseUrl ?? '';

  const request = async <T>(method: string, path: string, options: HttpRequestOptions = {}): Promise<T> => {
    const tokenProvider = getReactiveRuntimeConfig().getAccessToken;
    const token = tokenProvider ? await tokenProvider() : undefined;
    const resolvedBody = resolveRequestBody(options.body);

    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(resolvedBody.contentType ? { 'Content-Type': resolvedBody.contentType } : {}),
      ...(config.headers ?? {}),
      ...(options.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const url = buildUrl(baseUrl, path, options.query);

    let init: RequestInit = {
      method,
      headers,
      body: resolvedBody.body,
      signal: options.signal,
    };

    if (config.requestInterceptors) {
      for (const interceptor of config.requestInterceptors) {
        init = await interceptor(url, init);
      }
    }

    let response = await fetchImpl(url, init);

    if (config.responseInterceptors) {
      for (const interceptor of config.responseInterceptors) {
        response = await interceptor(response, url);
      }
    }

    const data = await parseResponseBody(response);

    if (!response.ok) {
      if (response.status === 401 && config.onUnauthorized) {
        await config.onUnauthorized();
      }

      const message =
        typeof data === 'object' && data !== null && 'message' in data && typeof data.message === 'string'
          ? data.message
          : `HTTP ${response.status}`;

      throw new ApiError(message, {
        status: response.status,
        url,
        details: data,
      });
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
