# Task 02: HTTP Primitives

## Purpose

Provide typed Fetch-based clients, deterministic URL and body conversion, normalized HTTP errors, and permissive collection-envelope unwrapping.

## Public Contract

The package root must export:

```ts
type HttpQueryPrimitive = string | number | boolean | null | undefined;
type HttpQueryValue = HttpQueryPrimitive | HttpQueryPrimitive[];

interface HttpRequestOptions {
  headers?: Record<string, string>;
  query?: Record<string, HttpQueryValue>;
  body?: unknown;
  signal?: AbortSignal;
}

type HttpRequestInterceptor = (url: string, init: RequestInit) => RequestInit | Promise<RequestInit>;
type HttpResponseInterceptor = (response: Response, url: string) => Response | Promise<Response>;

interface HttpClientConfig {
  baseUrl?: string;
  headers?: Record<string, string>;
  fetch?: typeof fetch;
  onUnauthorized?: () => void | Promise<void>;
  requestInterceptors?: HttpRequestInterceptor[];
  responseInterceptors?: HttpResponseInterceptor[];
}

interface HttpClient {
  request<T>(method: string, path: string, options?: HttpRequestOptions): Promise<T>;
  get<T>(path: string, options?: Omit<HttpRequestOptions, 'body'>): Promise<T>;
  post<T>(path: string, body?: unknown, options?: Omit<HttpRequestOptions, 'body'>): Promise<T>;
  put<T>(path: string, body?: unknown, options?: Omit<HttpRequestOptions, 'body'>): Promise<T>;
  patch<T>(path: string, body?: unknown, options?: Omit<HttpRequestOptions, 'body'>): Promise<T>;
  delete<T>(path: string, options?: Omit<HttpRequestOptions, 'body'>): Promise<T>;
}

class ApiError extends Error {
  status: number;
  url: string;
  details: unknown;
  constructor(message: string, options: { status: number; url: string; details?: unknown });
}

type HttpClientMap<TClients extends Record<string, string>> = {
  [Key in keyof TClients]: HttpClient;
};
type DefaultApiClientMap = { api: '/' };

interface CreateApiClientsOptions<TClients extends Record<string, string> = DefaultApiClientMap> extends Omit<
  HttpClientConfig,
  'baseUrl'
> {
  baseUrl: string;
  clients?: TClients;
  isDev?: boolean;
  devProxyPath?: string;
}
```

Values: `createHttpClient`, `createApiClients`, `normalizeHttpError`, `buildUrl`, `resolveRequestBody`, `parseResponseBody`, and `unwrapCollectionResponse`.

## Request Lifecycle

| ID       | Requirement                                                                                                                                                                                            | Provenance |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| HTTP-001 | `createHttpClient()` accepts an omitted config, captures `config.fetch ?? globalThis.fetch`, and captures `baseUrl ?? ''` when constructed.                                                            | SOURCE     |
| HTTP-002 | Every request obtains and awaits the current runtime access-token provider before body resolution, interceptors, or Fetch. A falsy token produces no authorization header.                             | SOURCE     |
| HTTP-003 | Header precedence from lowest to highest is default `Accept: application/json`, inferred body content type, client headers, request headers, then generated bearer authorization.                      | SOURCE     |
| HTTP-004 | Request interceptors execute sequentially in declaration order and each receives the URL plus the previous interceptor's `RequestInit`. Sync and async results are accepted.                           | SOURCE     |
| HTTP-005 | Fetch receives the final URL and init, including method, headers, resolved body, and caller AbortSignal.                                                                                               | SOURCE     |
| HTTP-006 | Response interceptors execute sequentially after Fetch and may replace the Response used by later interceptors, parsing, status handling, and return.                                                  | SOURCE     |
| HTTP-007 | The final response body is parsed before status handling. Parse failures reject directly and do not become `ApiError`; a 401 parse failure does not call `onUnauthorized`.                             | SOURCE     |
| HTTP-008 | For a parsed non-OK response, await `onUnauthorized` only when the final status is 401, then throw `ApiError`. If that callback rejects, its error wins.                                               | SOURCE     |
| HTTP-009 | `ApiError.message` is a string `message` property from an object response body, otherwise `HTTP <status>`. It also exposes final status, requested URL, parsed body as `details`, and name `ApiError`. | SOURCE     |
| HTTP-010 | Successful data is returned as generic `T` without runtime validation. Fetch, token-provider, interceptor, callback, and parsing errors otherwise propagate unchanged.                                 | SOURCE     |
| HTTP-011 | Verb helpers use uppercase methods. POST, PUT, and PATCH place their separate body argument into options; GET and DELETE do not accept a body in their public types.                                   | SOURCE     |

`Response.ok` defines success, normally status 200-299. Redirect handling remains delegated to Fetch.

## URL And Query Rules

| ID       | Requirement                                                                                                                                                                                                                                                                                                                                                                           | Provenance    |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| HTTP-012 | `buildUrl` removes trailing `/` from the base and leading `/` from the request path, then joins them with exactly one `/`. Apply this uniformly to absolute and relative bases so an absolute base pathname is retained. An empty base produces a root-relative path.                                                                                                                 | USER: DEC-001 |
| HTTP-013 | Apply the same path-joining rule to absolute and relative bases, preserving an absolute base pathname such as `/api`. Parse and serialize query and fragment components with the platform URL API.                                                                                                                                                                                    | USER: DEC-001 |
| HTTP-014 | Query object properties are processed in enumeration order. Scalar values use string conversion and one value; arrays append one value per non-nullish item in array order.                                                                                                                                                                                                           | SOURCE        |
| HTTP-015 | Top-level and array-item `null` or `undefined` values are omitted. Empty arrays emit no parameter. Existing query text in `path` is preserved and supplied keys are added or replaced according to URLSearchParams `append`/`set` behavior. Relative-base output drops a path fragment because it returns only pathname and search; absolute-base output uses full URL serialization. | SOURCE        |
| HTTP-016 | URL encoding follows the platform `URL` and `URLSearchParams` behavior.                                                                                                                                                                                                                                                                                                               | SOURCE        |

This intentionally corrects the legacy absolute-base behavior described by DEC-001.

## Request Body Rules

| Input                                            | Fetch body              | Inferred content type |
| ------------------------------------------------ | ----------------------- | --------------------- |
| `undefined` or `null`                            | `undefined`             | none                  |
| `FormData`, `URLSearchParams`, `Blob`, or string | same value              | none                  |
| every other value                                | `JSON.stringify(value)` | `application/json`    |

| ID       | Requirement                                                                                                              | Provenance |
| -------- | ------------------------------------------------------------------------------------------------------------------------ | ---------- |
| HTTP-017 | Explicit client or request `Content-Type` headers may override the inferred JSON header.                                 | SOURCE     |
| HTTP-018 | The body helper does not catch serialization errors or validate whether a resulting body is legal for the chosen method. | SOURCE     |
| HTTP-019 | Body-class detection uses the host platform classes; environments using this helper must provide them.                   | SOURCE     |

## Response Parsing And Error Normalization

| ID       | Requirement                                                                                                                                                                                 | Provenance |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| HTTP-020 | Status 204 returns `undefined` without reading the body.                                                                                                                                    | SOURCE     |
| HTTP-021 | A content-type containing the case-sensitive substring `application/json` is parsed with `response.json()`; every other response is read with `response.text()`.                            | SOURCE     |
| HTTP-022 | `normalizeHttpError` returns an existing `Error` unchanged. Any other value becomes `new Error(fallback)`, where fallback defaults to `Request failed`; the original value is not retained. | SOURCE     |

## Client Groups

| ID       | Requirement                                                                                                                                                                                              | Provenance |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| HTTP-023 | `createApiClients` returns one client per own enumerable entry of `clients`, preserving keys in the mapped return type. Omitted `clients` means `{ api: '/' }`; an empty object returns an empty object. | SOURCE     |
| HTTP-024 | Trim whitespace around the supplied `baseUrl`. Only when `isDev === true` and the trimmed base is empty, use `devProxyPath ?? '/api'`.                                                                   | SOURCE     |
| HTTP-025 | For each client path, strip trailing slashes from the effective base, add a leading slash to the client path if missing, concatenate them, and pass all shared client options through unchanged.         | SOURCE     |

## Collection Unwrapping

`unwrapCollectionResponse<T>` accepts an object, `T[]`, string, `null`, or `undefined` and returns `T[]`.

| ID       | Requirement                                                                                                                                                                                              | Provenance |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| HTTP-026 | Return a direct array by identity. For a string, JSON-parse and recursively process it; invalid JSON returns `[]`. Nullish and non-object values return `[]`.                                            | SOURCE     |
| HTTP-027 | Search object keys in this priority order: `items`, `Items`, `data`, `Data`, `results`, `Results`, `value`, `Value`, `$values`. A direct array at a priority key wins, including an empty array.         | SOURCE     |
| HTTP-028 | At each object level, after priority-key recursion, return the first array among all property values; then recursively inspect object-valued properties in enumeration order.                            | SOURCE     |
| HTTP-029 | Prevent cycles by object identity and stop descending when recursion depth reaches 3. A nested empty result does not stop the parent from searching later candidates. Return `[]` when nothing is found. | SOURCE     |
| HTTP-030 | The helper performs no item validation and trusts generic `T`.                                                                                                                                           | SOURCE     |

## Acceptance Criteria

1. A fake token provider and Fetch verify exact call order, header precedence, body, URL, and AbortSignal forwarding.
2. Sync and async interceptors demonstrate sequential transformation and response replacement.
3. Responses covering 204, JSON, text, malformed JSON, 401, another non-OK status, and callback rejection match HTTP-007 through HTTP-010 and HTTP-020 through HTTP-022.
4. URL scenarios cover empty/relative/absolute bases, existing query text, scalar and repeated query values, nullish omission, and encoding.
5. Client groups cover default, custom, empty, development-proxy, and non-empty development-base cases.
6. Collection scenarios cover every priority key, nested wrappers, invalid strings, cycles, depth limit, empty arrays, and unrelated arrays.

## Exclusions

- Automatic retry, timeout, refresh-token flow, response schema validation, or request deduplication.
- Automatic case normalization or use of the `Headers` class.
- Support for protocols other than relative URLs, HTTP, and HTTPS.
