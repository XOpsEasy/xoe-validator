const isIndex = (key: string) => /^\d+$/.test(key);

/** Reads the value at a dotted path ("items.0.price"). */
export const getIn = (source: unknown, path: string): unknown =>
  path.split(".").reduce<unknown>((current, key) => {
    if (current === null || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[key];
  }, source);

const setAt = (source: unknown, keys: string[], value: unknown): unknown => {
  const [key, ...rest] = keys;
  if (key === undefined) return value;
  if (Array.isArray(source) || (source == null && isIndex(key))) {
    const copy = [...((source as unknown[] | null) ?? [])];
    copy[Number(key)] = setAt(copy[Number(key)], rest, value);
    return copy;
  }
  const record = (source ?? {}) as Record<string, unknown>;
  return { ...record, [key]: setAt(record[key], rest, value) };
};

/** A copy of `source` with the value at a dotted path replaced. */
export const setIn = <T>(source: T, path: string, value: unknown): T =>
  setAt(source, path.split("."), value) as T;
