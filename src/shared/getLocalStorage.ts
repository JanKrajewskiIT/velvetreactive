export const getLocalStorage = (): Storage | undefined => {
  try {
    return globalThis.localStorage;
  } catch {
    // Browsers throw a SecurityError when storage access is denied; treat it as an absent API.
    return undefined;
  }
};
