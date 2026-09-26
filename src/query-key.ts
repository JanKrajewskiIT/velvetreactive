export type QueryKeyPart = unknown;
export type QueryKey = readonly QueryKeyPart[];

type NormalizedValue = readonly unknown[];

const normalizeValue = (value: unknown, ancestors: Set<object>): NormalizedValue => {
  if (value === null) return ['null'];
  if (value === undefined) return ['undefined'];

  switch (typeof value) {
    case 'string':
      return ['string', value];
    case 'boolean':
      return ['boolean', value];
    case 'number':
      if (Object.is(value, -0)) return ['number', '-0'];
      if (Number.isNaN(value)) return ['number', 'NaN'];
      if (value === Infinity) return ['number', 'Infinity'];
      if (value === -Infinity) return ['number', '-Infinity'];
      return ['number', value];
    case 'bigint':
    case 'symbol':
    case 'function':
      throw new TypeError(`Unsupported query key value: ${typeof value}`);
  }

  if (ancestors.has(value)) {
    throw new TypeError('Query keys must not contain cycles');
  }

  const prototype = Object.getPrototypeOf(value) as object | null;
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
    throw new TypeError('Query keys may contain only arrays and plain objects');
  }

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      return ['array', ...value.map((item) => normalizeValue(item, ancestors))];
    }

    const entries = Object.keys(value)
      .sort()
      .map((key) => [key, normalizeValue((value as Record<string, unknown>)[key], ancestors)] as const);
    return ['object', ...entries];
  } finally {
    ancestors.delete(value);
  }
};

export const normalizeQueryKey = (key: QueryKey): NormalizedValue => normalizeValue(key, new Set());

export const hashQueryKey = (key: QueryKey): string => JSON.stringify(normalizeQueryKey(key));

export const matchesPartialKey = (full: QueryKey, partial: QueryKey): boolean => {
  const normalizedFull = normalizeQueryKey(full).slice(1);
  const normalizedPartial = normalizeQueryKey(partial).slice(1);
  return normalizedPartial.every((part, index) => JSON.stringify(part) === JSON.stringify(normalizedFull[index]));
};
