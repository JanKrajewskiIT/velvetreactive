import type { JSX, ParentProps } from 'solid-js';
import { createComponent, onCleanup, untrack } from 'solid-js';

import { createQueryClient } from './queryClient.js';
import { QueryClientContext } from './queryContext.js';
import type { CreateQueryClientOptions, QueryClient } from './queryTypes.js';

export interface QueryClientProviderProps extends ParentProps {
  client?: QueryClient;
  options?: CreateQueryClientOptions;
}

const createOwnedQueryClient = (options: CreateQueryClientOptions | undefined): QueryClient => {
  const client = createQueryClient(options);
  onCleanup(client.dispose);
  return client;
};

export const QueryClientProvider = (props: QueryClientProviderProps): JSX.Element => {
  const client = untrack(() => props.client) ?? createOwnedQueryClient(untrack(() => props.options));
  return createComponent(QueryClientContext.Provider, {
    value: client,
    get children() {
      return props.children;
    },
  });
};
