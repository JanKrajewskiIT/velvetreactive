import { getDefaultQueryClient } from './queryContext.js';
import type { QueryClient, QueryKey } from './queryTypes.js';

export const invalidateQuery = (key: QueryKey, client: QueryClient = getDefaultQueryClient()): void => {
  client.invalidateQueries(key);
};
