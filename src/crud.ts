import type { HttpClient } from './http.js';
import { createMutationSignal, type MutationSignal } from './mutation.js';
import type { QueryClient } from './query-client.js';
import { useQueryClient } from './query-context.js';
import { createQuerySignal, type QuerySignal } from './query-signal.js';

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

export const createCrudSignals = <TEntity, TCreate, TUpdate, TId extends string | number>(
  options: CreateCrudSignalsOptions,
): CrudSignals<TEntity, TCreate, TUpdate, TId> => {
  const queryClient = options.queryClient ?? useQueryClient();
  const invalidate = (): void => queryClient.invalidateQueries(options.queryKey);
  const list = createQuerySignal<TEntity[]>({
    key: options.queryKey,
    client: queryClient,
    query: (signal) => options.client.get<TEntity[]>(options.resourcePath, signal === undefined ? {} : { signal }),
    ...(options.staleTime === undefined ? {} : { staleTime: options.staleTime }),
  });
  const create = createMutationSignal((body: TCreate) => options.client.post<TEntity>(options.resourcePath, body), {
    onSuccess: invalidate,
  });
  const update = createMutationSignal(
    ({ id, body }: { id: TId; body: TUpdate }) => options.client.put<TEntity>(`${options.resourcePath}/${id}`, body),
    { onSuccess: invalidate },
  );
  const remove = createMutationSignal(
    async (id: TId) => {
      await options.client.delete<unknown>(`${options.resourcePath}/${id}`);
      return undefined;
    },
    { onSuccess: invalidate },
  );
  return { list, create, update, remove };
};
