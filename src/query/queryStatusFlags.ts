import type { Accessor } from 'solid-js';

import type { QueryStatus } from './queryTypes.js';

export interface QueryStatusFlags {
  readonly isLoading: boolean;
  readonly isFetching: boolean;
  readonly isError: boolean;
  readonly isSuccess: boolean;
  readonly error: Error | undefined;
}

export interface QueryStatusSource {
  status: Accessor<QueryStatus>;
  isFetching: Accessor<boolean>;
  error: Accessor<Error | undefined>;
}

export const createQueryStatusFlags = (source: QueryStatusSource): QueryStatusFlags => ({
  get isLoading() {
    return source.status() === 'loading';
  },
  get isFetching() {
    return source.isFetching();
  },
  get isError() {
    return source.status() === 'error';
  },
  get isSuccess() {
    return source.status() === 'success';
  },
  get error() {
    return source.error();
  },
});
