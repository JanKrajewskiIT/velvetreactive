import type { HttpRequestOptions } from './types';

export const buildUrl = (baseUrl: string, path: string, query?: HttpRequestOptions['query']): string => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const base = baseUrl.replace(/\/+$/u, '');
  const isAbsoluteBase = /^https?:\/\//u.test(base);
  const url = isAbsoluteBase ? new URL(normalizedPath, `${base}/`) : new URL(normalizedPath, 'http://localhost');

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null) {
        return;
      }

      if (Array.isArray(value)) {
        value.forEach((entry) => {
          if (entry === undefined || entry === null) {
            return;
          }

          url.searchParams.append(key, String(entry));
        });
        return;
      }

      url.searchParams.set(key, String(value));
    });
  }

  if (isAbsoluteBase) {
    return url.toString();
  }

  return `${base}${url.pathname}${url.search}`;
};

export const resolveRequestBody = (
  body: HttpRequestOptions['body'],
): {
  body: BodyInit | undefined;
  contentType?: string;
} => {
  if (body === undefined || body === null) {
    return { body: undefined };
  }

  if (body instanceof FormData || body instanceof URLSearchParams || body instanceof Blob || typeof body === 'string') {
    return { body };
  }

  return {
    body: JSON.stringify(body),
    contentType: 'application/json',
  };
};

export const parseResponseBody = async (response: Response): Promise<unknown> => {
  if (response.status === 204) {
    return undefined;
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return response.json();
  }

  return response.text();
};
