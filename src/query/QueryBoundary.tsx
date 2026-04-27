import { type JSX, Match, Switch } from 'solid-js';

import type { AppQueryResult } from './createAppSignals';

export interface QueryBoundaryProps<TData> {
  query: AppQueryResult<TData>;
  loadingFallback?: JSX.Element;
  errorFallback?: (error: Error, retry: () => void) => JSX.Element;
  children: (data: TData) => JSX.Element;
}

const QueryBoundary = <TData,>(props: QueryBoundaryProps<TData>): JSX.Element => {
  const error = () => props.query.error;
  const retry = () => void props.query.refetch();

  return (
    <Switch>
      <Match when={props.query.isLoading}>{props.loadingFallback}</Match>
      <Match when={props.query.isError && error()}>{(err) => props.errorFallback?.(err(), retry)}</Match>
      <Match when={props.query.isSuccess && props.query.data !== undefined}>
        {props.children(props.query.data as TData)}
      </Match>
    </Switch>
  );
};

export default QueryBoundary;
