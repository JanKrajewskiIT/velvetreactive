const PRIORITY_KEYS = ['items', 'Items', 'data', 'Data', 'results', 'Results', 'value', 'Value', '$values'] as const;
const MAX_DEPTH = 3;

type CollectionSource<T> = T[] | object | string | null | undefined;

const isObject = (value: unknown): value is object => typeof value === 'object' && value !== null;

const searchObject = (value: object, depth: number, ancestors: Set<object>): unknown[] => {
  if (depth >= MAX_DEPTH || ancestors.has(value)) {
    return [];
  }
  ancestors.add(value);
  try {
    const record = value as Record<string, unknown>;
    const recurse = (candidate: unknown): unknown[] =>
      isObject(candidate) && !Array.isArray(candidate) ? searchObject(candidate, depth + 1, ancestors) : [];

    for (const key of PRIORITY_KEYS) {
      const candidate = Object.hasOwn(record, key) ? record[key] : undefined;
      if (Array.isArray(candidate)) {
        return candidate as unknown[];
      }
      const nested = recurse(candidate);
      if (nested.length > 0) {
        return nested;
      }
    }
    const candidates = Object.values(record);
    const firstArray = candidates.find((candidate): candidate is unknown[] => Array.isArray(candidate));
    if (firstArray !== undefined) {
      return firstArray;
    }
    for (const candidate of candidates) {
      const nested = recurse(candidate);
      if (nested.length > 0) {
        return nested;
      }
    }
    return [];
  } finally {
    ancestors.delete(value);
  }
};

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
};

const unwrap = (source: unknown, depth: number, ancestors: Set<object>): unknown[] => {
  if (Array.isArray(source)) {
    return source as unknown[];
  }
  if (typeof source === 'string') {
    const parsed = parseJson(source);
    return parsed === undefined ? [] : unwrap(parsed, depth, ancestors);
  }
  return isObject(source) ? searchObject(source, depth, ancestors) : [];
};

export const unwrapCollectionResponse = <T>(source: CollectionSource<T>): T[] => unwrap(source, 0, new Set()) as T[];
