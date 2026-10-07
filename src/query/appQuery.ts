import type { Accessor } from 'solid-js';
import { createMemo, mergeProps } from 'solid-js';

import type { AuthStateAdapter } from './appQueryCore.js';
import { createSourcedAppQuery } from './appQueryCore.js';
import type { CreateQuerySignalOptions } from './querySignal.js';
import { toQuerySource } from './querySignal.js';
import type { QueryStatusFlags } from './queryStatusFlags.js';
import { createQueryStatusFlags } from './queryStatusFlags.js';

export interface CreateAppQueryOptions<TData> extends CreateQuerySignalOptions<TData> {
  auth?: AuthStateAdapter;
  watch?: Accessor<unknown>;
  select?: (data: TData) => unknown;
}

export interface AppQueryResult<TData> extends QueryStatusFlags {
  readonly data: TData | undefined;
  refetch: () => Promise<TData>;
  invalidate: () => void;
}

export function createAppQuery<TData, TSelected>(
  options: CreateAppQueryOptions<TData> & { select: (data: TData) => TSelected },
): AppQueryResult<TSelected>;
export function createAppQuery<TData>(options: CreateAppQueryOptions<TData>): AppQueryResult<TData>;
export function createAppQuery<TData>({
  key,
  query,
  select,
  ...appQueryOptions
}: CreateAppQueryOptions<TData>): AppQueryResult<unknown> {
  const querySignal = createSourcedAppQuery({ ...appQueryOptions, source: toQuerySource(key, query) });
  const selected = createMemo(() => {
    const data = querySignal.data();
    return data === undefined || select === undefined ? data : select(data);
  });

  return mergeProps(createQueryStatusFlags(querySignal), {
    get data() {
      return selected();
    },
    refetch: () => (select === undefined ? querySignal.refetch() : querySignal.refetch().then(select)),
    invalidate: querySignal.invalidate,
  });
}
