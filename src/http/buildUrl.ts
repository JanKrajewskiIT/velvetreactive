import type { HttpQueryValue } from './httpTypes.js';
import { trimLeadingSlashes, trimTrailingSlashes } from './trimSlashes.js';

const ABSOLUTE_BASE_PATTERN = /^https?:\/\//iu;
const RELATIVE_URL_ORIGIN = 'http://relative.invalid';

const applyQuery = (searchParams: URLSearchParams, query: Record<string, HttpQueryValue>): void => {
  for (const [name, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== null && item !== undefined) {
          searchParams.append(name, String(item));
        }
      }
    } else if (value !== null && value !== undefined) {
      searchParams.set(name, String(value));
    }
  }
};

export const buildUrl = (baseUrl: string, path: string, query: Record<string, HttpQueryValue> = {}): string => {
  const joined = `${trimTrailingSlashes(baseUrl)}/${trimLeadingSlashes(path)}`;
  if (ABSOLUTE_BASE_PATTERN.test(baseUrl)) {
    const url = new URL(joined);
    applyQuery(url.searchParams, query);
    return url.toString();
  }
  const url = new URL(joined, RELATIVE_URL_ORIGIN);
  applyQuery(url.searchParams, query);
  return `${url.pathname}${url.search}`;
};
