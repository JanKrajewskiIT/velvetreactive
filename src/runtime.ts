import type { CreateQueryClientOptions } from './query/types';

interface ReactiveRuntimeConfig {
  getAccessToken?: () => Promise<string | undefined> | string | undefined;
  queryClientOptions?: CreateQueryClientOptions;
}

interface ConfigureReactiveOptions {
  getAccessToken?: () => Promise<string | undefined> | string | undefined;
  queryClientOptions?: CreateQueryClientOptions;
}

const runtimeConfig: ReactiveRuntimeConfig = {};

const configureReactive = (options: ConfigureReactiveOptions): void => {
  if (options.getAccessToken !== undefined) {
    runtimeConfig.getAccessToken = options.getAccessToken;
  }

  if (options.queryClientOptions !== undefined) {
    runtimeConfig.queryClientOptions = options.queryClientOptions;
  }
};

const getReactiveRuntimeConfig = (): ReactiveRuntimeConfig => runtimeConfig;

export type { ConfigureReactiveOptions, ReactiveRuntimeConfig };
export { configureReactive, getReactiveRuntimeConfig };
