import type { JSX } from 'solid-js';
import { createComponent, Match, Switch } from 'solid-js';

import { ignoreRecordedFailure } from '../shared/ignoreRecordedFailure.js';
import type { AppQueryResult } from './appQuery.js';

export interface QueryBoundaryProps<TData> {
  query: AppQueryResult<TData>;
  loadingFallback?: JSX.Element;
  errorFallback?: (error: Error, retry: () => void) => JSX.Element;
  children: (data: TData) => JSX.Element;
}

interface KeyedMatchProps<TValue> {
  when: TValue | undefined;
  keyed: true;
  children: (value: NonNullable<TValue>) => JSX.Element;
}

const KeyedMatch = Match as <TValue>(props: KeyedMatchProps<TValue>) => JSX.Element;

const createBranch = <TValue>(
  when: () => TValue | undefined,
  render: (value: NonNullable<TValue>) => JSX.Element,
): JSX.Element =>
  createComponent(KeyedMatch<TValue>, {
    get when() {
      return when();
    },
    keyed: true,
    children: render,
  });

export const QueryBoundary = <TData>(props: QueryBoundaryProps<TData>): JSX.Element => {
  const retry = (): void => {
    props.query.refetch().catch(ignoreRecordedFailure);
  };

  return createComponent(Switch, {
    get children() {
      return [
        createBranch(
          () => (props.query.isLoading ? true : undefined),
          () => props.loadingFallback,
        ),
        createBranch(
          () => (props.query.isError ? props.query.error : undefined),
          (error) => props.errorFallback?.(error, retry),
        ),
        createBranch(
          () => (props.query.isSuccess && props.query.data !== undefined ? { value: props.query.data } : undefined),
          ({ value }) => props.children(value),
        ),
      ];
    },
  });
};
