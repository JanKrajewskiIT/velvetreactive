import type { CreateQueryClientOptions } from '../query/queryTypes.js';

export interface ReactiveRuntimeConfig {
  getAccessToken?: () => Promise<string | undefined> | string | undefined;
  queryClientOptions?: CreateQueryClientOptions;
}

export type ConfigureReactiveOptions = ReactiveRuntimeConfig;

let runtimeConfig: ReactiveRuntimeConfig = {};

const withoutUndefinedFields = (options: ConfigureReactiveOptions): ReactiveRuntimeConfig =>
  Object.fromEntries(Object.entries(options).filter(([, value]) => value !== undefined));

export const configureReactive = (options: ConfigureReactiveOptions): void => {
  if (typeof window === 'undefined') {
    throw new Error('Reactive runtime configuration is browser-only: window is not available.');
  }
  runtimeConfig = { ...runtimeConfig, ...withoutUndefinedFields(options) };
};

export const getReactiveRuntimeConfig = (): Readonly<ReactiveRuntimeConfig> => ({ ...runtimeConfig });
