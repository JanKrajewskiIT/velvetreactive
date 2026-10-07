import type { MutationState } from './mutationTypes.js';

export const createIdleMutationState = <TData>(): MutationState<TData> => ({
  status: 'idle',
  data: undefined,
  error: undefined,
});

export const toPendingMutationState = <TData>(previous: MutationState<TData>): MutationState<TData> => ({
  status: 'pending',
  data: previous.data,
  error: undefined,
});

export const createSuccessMutationState = <TData>(data: TData): MutationState<TData> => ({
  status: 'success',
  data,
  error: undefined,
});

export const toFailedMutationState = <TData>(previous: MutationState<TData>, error: Error): MutationState<TData> => ({
  status: 'error',
  data: previous.data,
  error,
});
