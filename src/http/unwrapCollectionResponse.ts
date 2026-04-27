const collectionKeys = ['items', 'Items', 'data', 'Data', 'results', 'Results', 'value', 'Value', '$values'] as const;

type CollectionEnvelope<TItem> = Record<string, unknown> | TItem[] | string | null | undefined;

const MAX_DEPTH = 3;

const findCollection = <TItem>(value: Record<string, unknown>, seen: WeakSet<object>, depth: number): TItem[] => {
  if (depth >= MAX_DEPTH || seen.has(value)) {
    return [];
  }

  seen.add(value);

  for (const key of collectionKeys) {
    const entry = value[key];

    if (Array.isArray(entry)) {
      return entry as TItem[];
    }

    if (entry && typeof entry === 'object') {
      const nested = findCollection<TItem>(entry as Record<string, unknown>, seen, depth + 1);

      if (nested.length > 0) {
        return nested;
      }
    }
  }

  for (const entry of Object.values(value)) {
    if (Array.isArray(entry)) {
      return entry as TItem[];
    }
  }

  for (const entry of Object.values(value)) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }

    const nested = findCollection<TItem>(entry as Record<string, unknown>, seen, depth + 1);

    if (nested.length > 0) {
      return nested;
    }
  }

  return [];
};

const unwrapCollectionResponse = <TItem>(response: CollectionEnvelope<TItem>): TItem[] => {
  if (Array.isArray(response)) {
    return response;
  }

  if (typeof response === 'string') {
    try {
      return unwrapCollectionResponse(JSON.parse(response) as CollectionEnvelope<TItem>);
    } catch {
      return [];
    }
  }

  if (!response || typeof response !== 'object') {
    return [];
  }

  return findCollection<TItem>(response, new WeakSet<object>(), 0);
};

export { unwrapCollectionResponse };
