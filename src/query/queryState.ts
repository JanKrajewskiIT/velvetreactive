import type { QueryState } from './queryTypes.js';

export const createIdleState = <TData>(): QueryState<TData> => ({
  status: 'idle',
  data: undefined,
  error: undefined,
  updatedAt: undefined,
  isFetching: false,
});

export const createSuccessState = <TData>(data: TData, updatedAt: number | undefined): QueryState<TData> => ({
  status: 'success',
  data,
  error: undefined,
  updatedAt,
  isFetching: false,
});

export const toFetchingState = <TData>(previous: QueryState<TData>): QueryState<TData> => ({
  ...previous,
  status: previous.status === 'idle' ? 'loading' : previous.status,
  error: undefined,
  isFetching: true,
});

export const toFailedState = <TData>(previous: QueryState<TData>, error: Error): QueryState<TData> => ({
  ...previous,
  status: 'error',
  error,
  isFetching: false,
});

export const toAbortedState = <TData>(previous: QueryState<TData>): QueryState<TData> => ({
  ...previous,
  status: previous.status === 'success' || previous.data !== undefined ? 'success' : 'idle',
  isFetching: false,
});
