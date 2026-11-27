import { hasOwn } from "./ownProperties.ts";
import { isValidDate } from "./typeName.ts";

// Pairs being compared, so cyclic values compare as equal instead of
// recursing forever.
type Seen = Map<object, Set<object>>;

const compare = (a: unknown, b: unknown, seen?: Seen): boolean => {
  // Numbers compare by value: 0 and -0 are equal (===), NaN equals NaN.
  if (a === b) return true;
  if (
    typeof a !== "object" ||
    typeof b !== "object" ||
    a === null ||
    b === null
  ) {
    return typeof a === "number" && typeof b === "number" && a !== a && b !== b;
  }

  if (a instanceof Date || b instanceof Date) {
    return isValidDate(a) && isValidDate(b) && a.getTime() === b.getTime();
  }

  // Pairs being compared further up count as equal (cycles). A pair is
  // removed when its comparison ends, so a failed comparison (e.g. a Set
  // member that didn't match) can't make the same pair equal later.
  seen ??= new Map();
  let pairs = seen.get(a);
  if (pairs?.has(b)) return true;
  if (!pairs) seen.set(a, (pairs = new Set()));
  pairs.add(b);
  try {
    return compareObjects(a, b, seen);
  } finally {
    pairs.delete(b);
  }
};

const compareObjects = (a: object, b: object, seen: Seen): boolean => {
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      return false;
    }
    // Index by index, so holes compare as undefined.
    for (let i = 0; i < a.length; i++) {
      if (!compare(a[i], b[i], seen)) return false;
    }
    return true;
  }

  if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false;

  if (a instanceof Map && b instanceof Map) {
    if (a.size !== b.size) return false;
    for (const [key, value] of a) {
      if (!b.has(key) || !compare(value, b.get(key), seen)) return false;
    }
    return true;
  }

  if (a instanceof Set && b instanceof Set) {
    if (a.size !== b.size) return false;
    const rest = [...b];
    return [...a].every((value) => {
      const index = rest.findIndex((other) => compare(value, other, seen));
      if (index === -1) return false;
      rest.splice(index, 1);
      return true;
    });
  }

  const recordA = a as Record<string, unknown>;
  const recordB = b as Record<string, unknown>;
  const keysA = Object.keys(recordA);

  return (
    keysA.length === Object.keys(recordB).length &&
    keysA.every(
      (key) =>
        hasOwn(recordB, key) && compare(recordA[key], recordB[key], seen),
    )
  );
};

/**
 * Deep equality of values: plain objects and arrays by their own enumerable
 * values, dates by time, Map and Set by their entries, numbers by value.
 */
export const deepEqual = (a: unknown, b: unknown): boolean => compare(a, b);
