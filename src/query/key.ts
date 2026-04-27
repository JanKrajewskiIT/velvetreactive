import type { QueryKey, QueryKeyPart } from './types';

const normalizeValue = (value: unknown): unknown => {
  if (value === undefined) {
    return '__undefined__';
  }

  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => normalizeValue(entry));
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
      left.localeCompare(right),
    );
    const normalizedObject: Record<string, unknown> = {};
    entries.forEach(([key, entry]) => {
      normalizedObject[key] = normalizeValue(entry);
    });
    return normalizedObject;
  }

  return Object.prototype.toString.call(value);
};

export const normalizeQueryKey = (key: QueryKey): unknown[] => key.map((part: QueryKeyPart) => normalizeValue(part));

export const hashQueryKey = (key: QueryKey): string => JSON.stringify(normalizeQueryKey(key));

export const matchesPartialKey = (full: QueryKey, partial: QueryKey): boolean => {
  if (partial.length > full.length) {
    return false;
  }

  const normalizedFull = normalizeQueryKey(full);
  const normalizedPartial = normalizeQueryKey(partial);

  for (let index = 0; index < normalizedPartial.length; index += 1) {
    if (JSON.stringify(normalizedFull[index]) !== JSON.stringify(normalizedPartial[index])) {
      return false;
    }
  }

  return true;
};
