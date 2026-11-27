/**
 * Helpers for objects that come from user input. They only look at own
 * properties, so keys such as "toString", "constructor" or "__proto__" are
 * treated like any other key.
 */

export const isPlainObject = (
  value: unknown,
): value is Record<string, unknown> =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  !(value instanceof Date);

/**
 * A plain record: an object created by a literal, JSON.parse or
 * Object.create(null). Unlike isPlainObject, class instances, Map, Set and
 * Promise don't count.
 */
export const isPlainRecord = (
  value: unknown,
): value is Record<string, unknown> => {
  if (typeof value !== "object" || value === null) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

export const hasOwn = (object: object, key: PropertyKey): boolean =>
  Object.prototype.hasOwnProperty.call(object, key);

export const getOwn = (object: Record<string, unknown>, key: string): unknown =>
  hasOwn(object, key) ? object[key] : undefined;

// Keys Object.prototype has. Assigning one goes through the inherited
// property: "__proto__" changes the prototype, and the others throw when
// Object.prototype is frozen (prototype pollution hardening).
const PROTOTYPE_KEYS = /* @__PURE__ */ new Set(
  Object.getOwnPropertyNames(Object.prototype),
);

/**
 * Sets an own property. Keys that Object.prototype has are defined; every
 * other key is assigned, which is much faster (this runs for every field of
 * every output object).
 */
export const setOwn = (
  object: Record<string, unknown>,
  key: string,
  value: unknown,
): void => {
  // The shortest such key is "valueOf": shorter keys skip the lookup.
  if (key.length >= 7 && PROTOTYPE_KEYS.has(key)) {
    Object.defineProperty(object, key, {
      value,
      enumerable: true,
      writable: true,
      configurable: true,
    });
  } else {
    object[key] = value;
  }
};
