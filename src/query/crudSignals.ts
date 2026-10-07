import type { HttpClient } from '../http/httpTypes.js';
import type { MutationSignal } from '../mutation/mutationSignal.js';
import { createMutationSignal } from '../mutation/mutationSignal.js';
import { useQueryClient } from './queryContext.js';
import type { QuerySignal } from './querySignal.js';
import { createQuerySignal } from './querySignal.js';
import type { QueryClient } from './queryTypes.js';

export interface CreateCrudSignalsOptions {
  client: HttpClient;
  queryClient?: QueryClient;
  queryKey: readonly (string | number | boolean | null | undefined)[];
  resourcePath: string;
  staleTime?: number;
}

export interface CrudSignals<TEntity, TCreate, TUpdate, TId extends string | number> {
  list: QuerySignal<TEntity[]>;
  create: MutationSignal<TEntity, TCreate>;
  update: MutationSignal<TEntity, { id: TId; body: TUpdate }>;
  remove: MutationSignal<undefined, TId>;
}

export const createCrudSignals = <TEntity, TCreate, TUpdate, TId extends string | number>({
  client,
  queryClient = useQueryClient(),
  queryKey,
  resourcePath,
  ...queryOptions
}: CreateCrudSignalsOptions): CrudSignals<TEntity, TCreate, TUpdate, TId> => {
  const entityPath = (id: TId): string => `${resourcePath}/${encodeURIComponent(String(id))}`;
  const invalidateList = (): void => {
    queryClient.invalidateQueries(queryKey);
  };

  return {
    list: createQuerySignal({
      ...queryOptions,
      key: queryKey,
      query: (signal) => client.get<TEntity[]>(resourcePath, { signal }),
      client: queryClient,
    }),
    create: createMutationSignal((body: TCreate) => client.post<TEntity>(resourcePath, body), {
      onSuccess: invalidateList,
    }),
    update: createMutationSignal(
      ({ id, body }: { id: TId; body: TUpdate }) => client.put<TEntity>(entityPath(id), body),
      {
        onSuccess: invalidateList,
      },
    ),
    remove: createMutationSignal(
      async (id: TId) => {
        await client.delete<unknown>(entityPath(id));
        return undefined;
      },
      { onSuccess: invalidateList },
    ),
  };
};
