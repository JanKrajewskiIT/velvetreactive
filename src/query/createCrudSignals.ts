import type { HttpClient } from '../http/types';
import { createMutationSignal } from './createMutationSignal';
import type { QueryClient } from './createQueryClient';
import { createQuerySignal } from './createQuerySignal';
import { useQueryClient } from './queryClientContext';
import type { MutationSignal, QuerySignal } from './types';

export interface CrudSignals<TEntity, TCreate, TUpdate, TId extends string | number> {
  list: QuerySignal<TEntity[]>;
  create: MutationSignal<TEntity, TCreate>;
  update: MutationSignal<TEntity, { id: TId; body: TUpdate }>;
  remove: MutationSignal<undefined, TId>;
}

export interface CreateCrudSignalsOptions {
  client: HttpClient;
  queryClient?: QueryClient;
  queryKey: readonly (string | number | boolean | null | undefined)[];
  resourcePath: string;
  staleTime?: number;
}

export const createCrudSignals = <TEntity, TCreate, TUpdate, TId extends string | number>(
  options: CreateCrudSignalsOptions,
): CrudSignals<TEntity, TCreate, TUpdate, TId> => {
  const queryClient = options.queryClient ?? useQueryClient();

  const list = createQuerySignal<TEntity[]>({
    key: options.queryKey,
    client: queryClient,
    staleTime: options.staleTime,
    query: (signal) =>
      options.client.get<TEntity[]>(options.resourcePath, {
        signal,
      }),
  });

  const create = createMutationSignal<TEntity, TCreate>(
    (body) => options.client.post<TEntity>(options.resourcePath, body),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(options.queryKey);
      },
    },
  );

  const update = createMutationSignal<TEntity, { id: TId; body: TUpdate }>(
    (input) => options.client.put<TEntity>(`${options.resourcePath}/${input.id}`, input.body),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(options.queryKey);
      },
    },
  );

  const remove = createMutationSignal<undefined, TId>(
    (id) => options.client.delete<undefined>(`${options.resourcePath}/${id}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(options.queryKey);
      },
    },
  );

  return {
    list,
    create,
    update,
    remove,
  };
};
