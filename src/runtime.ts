import type { CreateQueryClientOptions } from './query-client.js';

export interface ReactiveRuntimeConfig {
  getAccessToken?: () => Promise<string | undefined> | string | undefined;
  queryClientOptions?: CreateQueryClientOptions;
}

export interface ConfigureReactiveOptions {
  getAccessToken?: () => Promise<string | undefined> | string | undefined;
  queryClientOptions?: CreateQueryClientOptions;
}

let runtimeConfig: ReactiveRuntimeConfig = {};

export const configureReactive = (options: ConfigureReactiveOptions): void => {
  if (typeof window === 'undefined') {
    throw new Error('Reactive runtime configuration is browser-only');
  }

  runtimeConfig = {
    ...(options.getAccessToken !== undefined
      ? { getAccessToken: options.getAccessToken }
      : runtimeConfig.getAccessToken !== undefined
        ? { getAccessToken: runtimeConfig.getAccessToken }
        : {}),
    ...(options.queryClientOptions !== undefined
      ? { queryClientOptions: options.queryClientOptions }
      : runtimeConfig.queryClientOptions !== undefined
        ? { queryClientOptions: runtimeConfig.queryClientOptions }
        : {}),
  };
};

export const getReactiveRuntimeConfig = (): Readonly<ReactiveRuntimeConfig> => ({ ...runtimeConfig });
