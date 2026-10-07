import type { Accessor } from 'solid-js';
import { createSignal } from 'solid-js';

import { reportUnhandledError } from '../shared/reportUnhandledError.js';
import { toError } from '../shared/toError.js';
import {
  createIdleMutationState,
  createSuccessMutationState,
  toFailedMutationState,
  toPendingMutationState,
} from './mutationState.js';
import type { MutationOptions, MutationStatus } from './mutationTypes.js';

export type MutationOutcome<TData> =
  | { readonly status: 'success'; readonly data: TData; readonly callbackErrors: readonly Error[] }
  | { readonly status: 'error'; readonly error: Error; readonly callbackErrors: readonly Error[] };

export interface MutationEngine<TData, TVariables, TContext> {
  readonly status: Accessor<MutationStatus>;
  readonly data: Accessor<TData | undefined>;
  readonly error: Accessor<Error | undefined>;
  readonly run: (
    variables: TVariables,
    registrations: readonly MutationOptions<TData, TVariables, TContext>[],
  ) => Promise<MutationOutcome<TData>>;
  readonly execute: (
    variables: TVariables,
    registrations: readonly MutationOptions<TData, TVariables, TContext>[],
  ) => Promise<TData>;
  readonly reset: () => void;
}

const invokeAll = (invocations: readonly (() => void)[]): Error[] => {
  const failures: Error[] = [];
  for (const invoke of invocations) {
    try {
      invoke();
    } catch (thrown) {
      failures.push(toError(thrown, 'Mutation callback failed'));
    }
  }
  return failures;
};

export const createMutationEngine = <TData, TVariables, TContext>(
  mutationFn: (variables: TVariables) => Promise<TData>,
): MutationEngine<TData, TVariables, TContext> => {
  const [state, setState] = createSignal(createIdleMutationState<TData>());

  const collectContexts = async (
    variables: TVariables,
    registrations: readonly MutationOptions<TData, TVariables, TContext>[],
  ): Promise<(TContext | undefined)[]> => {
    const contexts: (TContext | undefined)[] = [];
    for (const registration of registrations) {
      contexts.push(await registration.onMutate?.(variables));
    }
    return contexts;
  };

  const run: MutationEngine<TData, TVariables, TContext>['run'] = async (variables, registrations) => {
    let contexts: (TContext | undefined)[];
    try {
      contexts = await collectContexts(variables, registrations);
    } catch (thrown) {
      const error = toError(thrown, 'onMutate failed');
      setState((previous) => toFailedMutationState(previous, error));
      return { status: 'error', error, callbackErrors: [] };
    }

    setState(toPendingMutationState);
    let data: TData;
    try {
      data = await mutationFn(variables);
    } catch (thrown) {
      const error = toError(thrown, 'Mutation failed');
      setState((previous) => toFailedMutationState(previous, error));
      const callbackErrors = invokeAll([
        ...registrations.map((registration, index) => () => registration.onError?.(error, variables, contexts[index])),
        ...registrations.map(
          (registration, index) => () => registration.onSettled?.(undefined, error, variables, contexts[index]),
        ),
      ]);
      return { status: 'error', error, callbackErrors };
    }

    setState(createSuccessMutationState(data));
    const callbackErrors = invokeAll([
      ...registrations.map((registration, index) => () => registration.onSuccess?.(data, variables, contexts[index])),
      ...registrations.map(
        (registration, index) => () => registration.onSettled?.(data, undefined, variables, contexts[index]),
      ),
    ]);
    return { status: 'success', data, callbackErrors };
  };

  const execute: MutationEngine<TData, TVariables, TContext>['execute'] = async (variables, registrations) => {
    const outcome = await run(variables, registrations);
    if (outcome.status === 'success') {
      const [firstFailure, ...otherFailures] = outcome.callbackErrors;
      otherFailures.forEach(reportUnhandledError);
      if (firstFailure !== undefined) {
        throw firstFailure;
      }
      return outcome.data;
    }
    outcome.callbackErrors.forEach(reportUnhandledError);
    throw outcome.error;
  };

  return {
    status: () => state().status,
    data: () => state().data,
    error: () => state().error,
    run,
    execute,
    reset: () => {
      setState(createIdleMutationState<TData>());
    },
  };
};
