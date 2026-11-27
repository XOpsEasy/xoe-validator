/**
 * Whether a value is a Date with a valid time. Safe for objects that only
 * look like dates (Object.create(Date.prototype) throws on getTime()).
 */
export const isValidDate = (value: unknown): value is Date => {
  if (!(value instanceof Date)) return false;
  try {
    return !Number.isNaN(value.getTime());
  } catch {
    return false;
  }
};

const isDateObject = (value: Date): boolean => {
  try {
    value.getTime();
    return true;
  } catch {
    return false;
  }
};

/**
 * The name of a value's type for issue params ("string", "null", "array",
 * "nan", "invalid date", ...). Never contains the value itself, so it's safe
 * to log and to send to clients.
 */
export const typeName = (value: unknown): string => {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "number") {
    if (Number.isNaN(value)) return "nan";
    return Number.isFinite(value) ? "number" : "infinity";
  }
  if (value instanceof Date && isDateObject(value)) {
    return isValidDate(value) ? "date" : "invalid date";
  }
  return typeof value;
};
