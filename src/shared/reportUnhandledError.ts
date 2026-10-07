export const reportUnhandledError = (error: Error): void => {
  queueMicrotask(() => {
    throw error;
  });
};
