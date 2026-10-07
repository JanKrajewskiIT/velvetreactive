import { createContext, DEV, useContext } from 'solid-js';

import { getReactiveRuntimeConfig } from '../runtime/runtimeConfig.js';
import { createQueryClient } from './queryClient.js';
import type { QueryClient } from './queryTypes.js';

export const QueryClientContext = createContext<QueryClient | undefined>(undefined);

let defaultQueryClient: QueryClient | undefined;
let hasWarnedAboutMissingProvider = false;

export const getDefaultQueryClient = (): QueryClient => {
  defaultQueryClient ??= createQueryClient(getReactiveRuntimeConfig().queryClientOptions);
  return defaultQueryClient;
};

export const useQueryClient = (): QueryClient => {
  const contextClient = useContext(QueryClientContext);
  if (contextClient !== undefined) {
    return contextClient;
  }
  if (DEV !== undefined && !hasWarnedAboutMissingProvider) {
    hasWarnedAboutMissingProvider = true;
    console.warn('No QueryClientProvider found; falling back to the process-wide default query client.');
  }
  return getDefaultQueryClient();
};
