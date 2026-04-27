import { createContext, useContext } from 'solid-js';

import { getReactiveRuntimeConfig } from '../runtime';
import { createQueryClient, type QueryClient } from './createQueryClient';

const QueryClientContext = createContext<QueryClient>();

let defaultQueryClient: QueryClient | undefined;

const getDefaultQueryClient = (): QueryClient => {
  if (!defaultQueryClient) {
    const config = getReactiveRuntimeConfig();
    defaultQueryClient = createQueryClient(config.queryClientOptions);
  }

  return defaultQueryClient;
};

const useQueryClient = (): QueryClient => useContext(QueryClientContext) ?? getDefaultQueryClient();

export { getDefaultQueryClient, QueryClientContext, useQueryClient };
