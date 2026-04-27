import { createMemo, createSignal } from 'solid-js';

import type { MutationOptions, MutationSignal, MutationState } from './types';

export const createMutationSignal = <TData, TVariables, TContext = unknown>(
  mutate: (variables: TVariables) => Promise<TData>,
  options: MutationOptions<TData, TVariables, TContext> = {},
): MutationSignal<TData, TVariables> => {
  const [state, setState] = createSignal<MutationState<TData>>({
    status: 'idle',
    data: undefined,
    error: undefined,
  });

  const run = async (variables: TVariables): Promise<TData> => {
    let context: TContext | undefined;

    try {
      if (options.onMutate) {
        context = await options.onMutate(variables);
      }
    } catch (mutateError: unknown) {
      const normalized = mutateError instanceof Error ? mutateError : new Error('onMutate failed');
      setState((previous) => ({
        ...previous,
        status: 'error',
        error: normalized,
      }));
      throw normalized;
    }

    setState((previous) => ({
      ...previous,
      status: 'pending',
      error: undefined,
    }));

    try {
      const result = await mutate(variables);
      setState({
        status: 'success',
        data: result,
        error: undefined,
      });
      options.onSuccess?.(result, variables, context);
      options.onSettled?.(result, undefined, variables, context);
      return result;
    } catch (error: unknown) {
      const normalized = error instanceof Error ? error : new Error('Mutation failed');
      setState((previous) => ({
        ...previous,
        status: 'error',
        error: normalized,
      }));
      options.onError?.(normalized, variables, context);
      options.onSettled?.(undefined, normalized, variables, context);
      throw normalized;
    }
  };

  const reset = () => {
    setState({
      status: 'idle',
      data: undefined,
      error: undefined,
    });
  };

  const status = createMemo(() => state().status);
  const data = createMemo(() => state().data);
  const error = createMemo(() => state().error);

  return {
    status,
    data,
    error,
    run,
    reset,
  };
};
