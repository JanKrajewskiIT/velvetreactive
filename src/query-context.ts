import {
  createComponent,
  createContext,
  createMemo,
  type JSX,
  onCleanup,
  type ParentProps,
  untrack,
  useContext,
} from 'solid-js';

import type { AppQueryResult } from './app-query.js';
import { createQueryClient, type CreateQueryClientOptions, type QueryClient } from './query-client.js';
import { getReactiveRuntimeConfig } from './runtime.js';

export const QueryClientContext = createContext<QueryClient>();

let defaultQueryClient: QueryClient | undefined;

export const getDefaultQueryClient = (): QueryClient => {
  defaultQueryClient ??= createQueryClient(getReactiveRuntimeConfig().queryClientOptions);
  return defaultQueryClient;
};

export const useQueryClient = (): QueryClient => useContext(QueryClientContext) ?? getDefaultQueryClient();

export interface QueryClientProviderProps extends ParentProps {
  client?: QueryClient;
  options?: CreateQueryClientOptions;
}

export const QueryClientProvider = (props: QueryClientProviderProps): JSX.Element => {
  const suppliedClient = untrack(() => props.client);
  const initialOptions = untrack(() => props.options);
  const client = suppliedClient ?? createQueryClient(initialOptions);
  if (suppliedClient === undefined) onCleanup(() => client.dispose());
  return createComponent(QueryClientContext.Provider, {
    value: client,
    get children() {
      return props.children;
    },
  });
};

export interface QueryBoundaryProps<TData> {
  query: AppQueryResult<TData>;
  loadingFallback?: JSX.Element;
  errorFallback?: (error: Error, retry: () => void) => JSX.Element;
  children: (data: TData) => JSX.Element;
}

export const QueryBoundary = <TData>(props: QueryBoundaryProps<TData>): JSX.Element => {
  const content = createMemo(() => {
    const query = props.query;
    if (query.isLoading) return props.loadingFallback;
    if (query.isError && query.error instanceof Error) {
      return props.errorFallback?.(query.error, () => {
        void query.refetch().catch(() => undefined);
      });
    }
    if (query.isSuccess && query.data !== undefined) return props.children(query.data);
    return undefined;
  });
  return content as unknown as JSX.Element;
};
