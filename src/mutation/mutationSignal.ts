import type { Accessor } from 'solid-js';

import { createMutationEngine } from './mutationEngine.js';
import type { MutationOptions, MutationStatus } from './mutationTypes.js';

export interface MutationSignal<TData, TVariables> {
  status: Accessor<MutationStatus>;
  data: Accessor<TData | undefined>;
  error: Accessor<Error | undefined>;
  run: (variables: TVariables) => Promise<TData>;
  reset: () => void;
}

export const createMutationSignal = <TData, TVariables, TContext = unknown>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: MutationOptions<TData, TVariables, TContext> = {},
): MutationSignal<TData, TVariables> => {
  const engine = createMutationEngine<TData, TVariables, TContext>(mutationFn);
  const registrations = [options];
  return {
    status: engine.status,
    data: engine.data,
    error: engine.error,
    run: (variables) => engine.execute(variables, registrations),
    reset: engine.reset,
  };
};
