import type { Accessor } from 'solid-js';
import { createEffect, on } from 'solid-js';

import type { QuerySignal, SourcedQuerySignalOptions } from './querySignal.js';
import { createSourcedQuerySignal } from './querySignal.js';

export interface AuthStateAdapter {
  isAuthenticated: Accessor<boolean>;
  user: Accessor<unknown>;
  accessToken: Accessor<string | undefined>;
}

export interface GatedQueryOptions<TData> extends SourcedQuerySignalOptions<TData> {
  auth?: AuthStateAdapter;
}

export interface SourcedAppQueryOptions<TData> extends GatedQueryOptions<TData> {
  watch?: Accessor<unknown>;
}

const isEnabledByDefault = (): boolean => true;

const isAuthReady = (auth: AuthStateAdapter | undefined): boolean => {
  if (auth === undefined || auth.isAuthenticated() || auth.accessToken() !== undefined) {
    return true;
  }
  const user = auth.user();
  return user !== null && user !== undefined;
};

export const createGatedQuerySignal = <TData>({
  auth,
  enabled = isEnabledByDefault,
  ...queryOptions
}: GatedQueryOptions<TData>): QuerySignal<TData> =>
  createSourcedQuerySignal({ ...queryOptions, enabled: () => enabled() && isAuthReady(auth) });

export const watchRevalidationTriggers = (
  auth: AuthStateAdapter | undefined,
  watch: Accessor<unknown> | undefined,
  onTrigger: () => void,
): void => {
  createEffect(
    on(
      [() => auth?.accessToken(), () => watch?.()],
      () => {
        onTrigger();
      },
      { defer: true },
    ),
  );
};

export const createSourcedAppQuery = <TData>({
  watch,
  ...gatedOptions
}: SourcedAppQueryOptions<TData>): QuerySignal<TData> => {
  const query = createGatedQuerySignal(gatedOptions);
  watchRevalidationTriggers(gatedOptions.auth, watch, query.invalidate);
  return query;
};
