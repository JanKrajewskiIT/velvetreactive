import { createHttpClient } from './createHttpClient.js';
import type { HttpClient, HttpClientConfig } from './httpTypes.js';
import { trimTrailingSlashes } from './trimSlashes.js';

export type HttpClientMap<TClients extends Record<string, string>> = {
  [Key in keyof TClients]: HttpClient;
};
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

const DEFAULT_CLIENTS: DefaultApiClientMap = { api: '/' };
const DEFAULT_DEV_PROXY_PATH = '/api';

export const createApiClients = <TClients extends Record<string, string> = DefaultApiClientMap>(
  options: CreateApiClientsOptions<TClients>,
): HttpClientMap<TClients> => {
  const { baseUrl, clients, isDev, devProxyPath, ...clientConfig } = options;
  const trimmedBaseUrl = baseUrl.trim();
  const effectiveBaseUrl =
    isDev === true && trimmedBaseUrl === '' ? (devProxyPath ?? DEFAULT_DEV_PROXY_PATH) : trimmedBaseUrl;
  const baseWithoutTrailingSlash = trimTrailingSlashes(effectiveBaseUrl);

  const entries = Object.entries(clients ?? DEFAULT_CLIENTS).map(([name, clientPath]): [string, HttpClient] => {
    const normalizedPath = clientPath.startsWith('/') ? clientPath : `/${clientPath}`;
    return [name, createHttpClient({ ...clientConfig, baseUrl: `${baseWithoutTrailingSlash}${normalizedPath}` })];
  });
  return Object.fromEntries(entries) as HttpClientMap<TClients>;
};
