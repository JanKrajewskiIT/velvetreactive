import type { QueryKey } from './queryTypes.js';

type SpecialNumberLabel = 'NaN' | 'Infinity' | '-Infinity' | '-0';

export type NormalizedQueryValue =
  | readonly ['null']
  | readonly ['undefined']
  | readonly ['string', string]
  | readonly ['boolean', boolean]
  | readonly ['number', number | SpecialNumberLabel]
  | readonly ['array', ...unknown[]]
  | readonly ['object', ...(readonly [string, unknown])[]];

export type NormalizedQueryKey = readonly NormalizedQueryValue[];

const isPlainObject = (value: object): boolean => {
  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
};

const normalizeNumber = (value: number): number | SpecialNumberLabel => {
  if (Number.isNaN(value)) {
    return 'NaN';
  }
  if (value === Infinity) {
    return 'Infinity';
  }
  if (value === -Infinity) {
    return '-Infinity';
  }
  return Object.is(value, -0) ? '-0' : value;
};

const normalizeValue = (value: unknown, ancestors: Set<object>): NormalizedQueryValue => {
  switch (typeof value) {
    case 'string':
      return ['string', value];
    case 'boolean':
      return ['boolean', value];
    case 'number':
      return ['number', normalizeNumber(value)];
    case 'undefined':
      return ['undefined'];
    case 'object':
      return value === null ? ['null'] : normalizeObject(value, ancestors);
    default:
      throw new TypeError(`Query keys cannot contain ${typeof value} values.`);
  }
};

const normalizeObject = (value: object, ancestors: Set<object>): NormalizedQueryValue => {
  if (ancestors.has(value)) {
    throw new TypeError('Query keys cannot contain circular references.');
  }
  if (!Array.isArray(value) && !isPlainObject(value)) {
    throw new TypeError('Query keys can contain only arrays and plain objects.');
  }
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      return ['array', ...Array.from(value as unknown[], (item) => normalizeValue(item, ancestors))];
    }
    const record = value as Record<string, unknown>;
    return [
      'object',
      ...Object.keys(record)
        .sort()
        .map((name): readonly [string, NormalizedQueryValue] => [name, normalizeValue(record[name], ancestors)]),
    ];
  } finally {
    ancestors.delete(value);
  }
};

export const normalizeQueryKey = (key: QueryKey): NormalizedQueryKey => {
  const ancestors = new Set<object>([key]);
  return key.map((part) => normalizeValue(part, ancestors));
};

export const hashQueryKey = (key: QueryKey): string => JSON.stringify(normalizeQueryKey(key));

export const isNormalizedKeyPrefix = (full: NormalizedQueryKey, prefix: NormalizedQueryKey): boolean =>
  prefix.length <= full.length && prefix.every((part, index) => JSON.stringify(part) === JSON.stringify(full[index]));

export const matchesPartialKey = (full: QueryKey, partial: QueryKey): boolean =>
  isNormalizedKeyPrefix(normalizeQueryKey(full), normalizeQueryKey(partial));
