import { reportUnhandledError } from '../shared/reportUnhandledError.js';
import { createMutationEngine } from './mutationEngine.js';
import type { MutationCallbacks, MutationOptions } from './mutationTypes.js';

export interface AppMutationResult<TData, TVariables, TContext = unknown> {
  readonly data: TData | undefined;
  readonly error: Error | undefined;
  readonly isError: boolean;
  readonly isPending: boolean;
  readonly isSuccess: boolean;
  mutate: (variables: TVariables, callbacks?: MutationCallbacks<TData, TVariables, TContext>) => void;
  mutateAsync: (variables: TVariables) => Promise<TData>;
  reset: () => void;
}

export interface CreateAppMutationOptions<TData, TVariables, TContext = unknown> extends MutationOptions<
  TData,
  TVariables,
  TContext
> {
  mutation: (variables: TVariables) => Promise<TData>;
}

export const createAppMutation = <TData, TVariables, TContext = unknown>({
  mutation,
  ...callbacks
}: CreateAppMutationOptions<TData, TVariables, TContext>): AppMutationResult<TData, TVariables, TContext> => {
  const engine = createMutationEngine<TData, TVariables, TContext>(mutation);
  const creationRegistrations = [callbacks];

  return {
    get data() {
      return engine.data();
    },
    get error() {
      return engine.error();
    },
    get isError() {
      return engine.status() === 'error';
    },
    get isPending() {
      return engine.status() === 'pending';
    },
    get isSuccess() {
      return engine.status() === 'success';
    },
    mutate: (variables, perCallCallbacks) => {
      const registrations =
        perCallCallbacks === undefined ? creationRegistrations : [...creationRegistrations, perCallCallbacks];
      // Operation failures are already published through mutation state; only callback failures remain to surface.
      void engine.run(variables, registrations).then((outcome) => {
        outcome.callbackErrors.forEach(reportUnhandledError);
      });
    },
    mutateAsync: (variables) => engine.execute(variables, creationRegistrations),
    reset: engine.reset,
  };
};
