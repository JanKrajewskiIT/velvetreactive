const SLASH = '/';

export const trimTrailingSlashes = (value: string): string => {
  let end = value.length;
  while (end > 0 && value[end - 1] === SLASH) {
    end -= 1;
  }
  return value.slice(0, end);
};

export const trimLeadingSlashes = (value: string): string => {
  let start = 0;
  while (start < value.length && value[start] === SLASH) {
    start += 1;
  }
  return value.slice(start);
};
