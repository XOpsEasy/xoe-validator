import { XOEUsageError } from "./errors.ts";

const isCopyable = (value: unknown): boolean => {
  if (Array.isArray(value) || value instanceof Date) return true;
  if (typeof value !== "object" || value === null) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

// What structuredClone copies as it is: plain objects, arrays, dates, Map,
// Set, RegExp, binary data and errors. It turns class instances into plain
// objects (losing their methods) and throws on functions.
const CLONED_PROTOTYPES: ReadonlySet<unknown> = /* @__PURE__ */ new Set([
  Object.prototype,
  null,
  Array.prototype,
  Date.prototype,
  Map.prototype,
  Set.prototype,
  RegExp.prototype,
  ArrayBuffer.prototype,
  Error.prototype,
  EvalError.prototype,
  RangeError.prototype,
  ReferenceError.prototype,
  SyntaxError.prototype,
  TypeError.prototype,
  URIError.prototype,
]);

/** Whether structuredClone copies `value` without changing what it is. */
const clonesFaithfully = (value: unknown, seen: Set<object>): boolean => {
  if (typeof value === "function") return false;
  if (typeof value !== "object" || value === null || seen.has(value)) {
    return true;
  }
  seen.add(value);
  if (!CLONED_PROTOTYPES.has(Object.getPrototypeOf(value))) {
    return ArrayBuffer.isView(value);
  }
  const items =
    value instanceof Map
      ? [...value.keys(), ...value.values()]
      : value instanceof Set
        ? [...value]
        : Object.values(value);
  return items.every((item) => clonesFaithfully(item, seen));
};

const uncopyable = () =>
  new XOEUsageError(
    "UNCOPYABLE_VALUE",
    "xoe: this value can't be copied (e.g. it contains functions or class instances); pass a function that returns a new value instead.",
  );

/**
 * Deep copy of plain objects, arrays and dates; other values (primitives,
 * class instances, Map, ...) are returned as is. Throws UNCOPYABLE_VALUE when
 * a copy would change a nested value (functions, class instances).
 */
export const copyValue = <T>(value: T): T => {
  if (!isCopyable(value)) return value;
  if (!clonesFaithfully(value, new Set())) throw uncopyable();
  return structuredClone(value);
};

// Functions made by constantOf, so toJsonSchema can tell a fixed default
// from a function the user passed (which it must not call).
const constants = /* @__PURE__ */ new WeakSet<() => unknown>();

/**
 * A function returning a fresh copy of `value` on every call, so a default or
 * fallback object can't be changed through one result and leak into the next.
 */
export const constantOf = <T>(value: T): (() => T) => {
  const snapshot = copyValue(value);
  // The snapshot is known to copy faithfully, so later copies skip the check.
  const constant = isCopyable(snapshot)
    ? () => structuredClone(snapshot)
    : () => snapshot;
  constants.add(constant);
  return constant;
};

/** Whether `fn` was made by constantOf (a fixed value, not a user function). */
export const isConstant = (fn: () => unknown): boolean => constants.has(fn);
