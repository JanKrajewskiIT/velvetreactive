import { type Accessor, createSignal } from 'solid-js';

export type MutationStatus = 'idle' | 'pending' | 'success' | 'error';

export interface MutationState<TData> {
  status: MutationStatus;
  data: TData | undefined;
  error: Error | undefined;
}

export interface MutationOptions<TData, TVariables, TContext = unknown> {
  onMutate?: (variables: TVariables) => TContext | Promise<TContext>;
  onSuccess?: (result: TData, variables: TVariables, context?: TContext) => void;
  onError?: (error: Error, variables: TVariables, context?: TContext) => void;
  onSettled?: (data: TData | undefined, error: Error | undefined, variables: TVariables, context?: TContext) => void;
}

export interface MutationSignal<TData, TVariables> {
  status: Accessor<MutationStatus>;
  data: Accessor<TData | undefined>;
  error: Accessor<Error | undefined>;
  run(variables: TVariables): Promise<TData>;
  reset(): void;
}

interface MutationRegistration<TData, TVariables, TContext> {
  options: MutationOptions<TData, TVariables, TContext>;
  context: TContext | undefined;
}

export interface MutationController<TData, TVariables, TContext> extends MutationSignal<TData, TVariables> {
  runWithOptions(variables: TVariables, additional?: MutationOptions<TData, TVariables, TContext>): Promise<TData>;
}

const initialMutationState = <TData>(): MutationState<TData> => ({
  status: 'idle',
  data: undefined,
  error: undefined,
});

const invokeAll = (callbacks: Array<() => void>): { threw: boolean; error: unknown } => {
  let threw = false;
  let firstError: unknown;
  for (const callback of callbacks) {
    try {
      callback();
    } catch (error) {
      if (!threw) firstError = error;
      threw = true;
    }
  }
  return { threw, error: firstError };
};

export const createMutationController = <TData, TVariables, TContext = unknown>(
  mutation: (variables: TVariables) => Promise<TData>,
  options: MutationOptions<TData, TVariables, TContext> = {},
): MutationController<TData, TVariables, TContext> => {
  const [state, setState] = createSignal(initialMutationState<TData>());

  const runWithOptions = async (
    variables: TVariables,
    additional?: MutationOptions<TData, TVariables, TContext>,
  ): Promise<TData> => {
    const registrations: MutationRegistration<TData, TVariables, TContext>[] = [
      { options, context: undefined },
      ...(additional === undefined ? [] : [{ options: additional, context: undefined }]),
    ];

    try {
      for (const registration of registrations) {
        registration.context = await registration.options.onMutate?.(variables);
      }
    } catch (reason) {
      const error = reason instanceof Error ? reason : new Error('onMutate failed');
      setState((previous) => ({ status: 'error', data: previous.data, error }));
      throw error;
    }

    setState((previous) => ({ status: 'pending', data: previous.data, error: undefined }));
    let result: TData;
    try {
      result = await mutation(variables);
    } catch (reason) {
      const error = reason instanceof Error ? reason : new Error('Mutation failed');
      setState((previous) => ({ status: 'error', data: previous.data, error }));
      invokeAll(
        registrations.map(
          (registration) => () => registration.options.onError?.(error, variables, registration.context),
        ),
      );
      invokeAll(
        registrations.map(
          (registration) => () => registration.options.onSettled?.(undefined, error, variables, registration.context),
        ),
      );
      throw error;
    }

    setState({ status: 'success', data: result, error: undefined });
    const callbackError = invokeAll([
      ...registrations.map(
        (registration) => () => registration.options.onSuccess?.(result, variables, registration.context),
      ),
      ...registrations.map(
        (registration) => () => registration.options.onSettled?.(result, undefined, variables, registration.context),
      ),
    ]);
    if (callbackError.threw) throw callbackError.error;
    return result;
  };

  return {
    status: () => state().status,
    data: () => state().data,
    error: () => state().error,
    run: (variables) => runWithOptions(variables),
    runWithOptions,
    reset: () => setState(initialMutationState<TData>()),
  };
};

export const createMutationSignal = <TData, TVariables, TContext = unknown>(
  mutation: (variables: TVariables) => Promise<TData>,
  options?: MutationOptions<TData, TVariables, TContext>,
): MutationSignal<TData, TVariables> => createMutationController(mutation, options);
