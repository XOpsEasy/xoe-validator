/**
 * Converts raw input (form fields, query params, JSON) to the target type.
 * The parameter types are the accepted inputs (InferInput); at runtime any
 * value can be passed.
 * Values that can't be converted are returned unchanged, so the type check
 * reports them. Blank strings become "", so required/optional still apply.
 */
const isBlank = (value: unknown) =>
  typeof value === "string" && value.trim() === "";

export const coerceString = (
  value: string | number | boolean | bigint,
): unknown =>
  typeof value === "number" ||
  typeof value === "boolean" ||
  typeof value === "bigint"
    ? String(value)
    : value;

// Plain decimal notation only: "12", "-3", "+4", "0.5", ".5", "5.".
// Hex, binary, octal, exponents, "Infinity", "1_000" and "1,5" are rejected.
const DECIMAL_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;

export const coerceNumber = (value: number | string): unknown => {
  if (typeof value !== "string") return value;
  if (isBlank(value)) return "";

  const trimmed = value.trim();
  return DECIMAL_PATTERN.test(trimmed) ? Number(trimmed) : value;
};

const TRUE_VALUES = ["true", "1", "on", "yes"];
const FALSE_VALUES = ["false", "0", "off", "no"];

export const coerceBoolean = (value: boolean | string | number): unknown => {
  if (typeof value === "number") {
    return value === 1 ? true : value === 0 ? false : value;
  }
  if (typeof value !== "string") return value;
  if (isBlank(value)) return "";

  const normalized = value.trim().toLowerCase();
  if (TRUE_VALUES.includes(normalized)) return true;
  if (FALSE_VALUES.includes(normalized)) return false;
  return value;
};

// The calendar date at the start of ISO strings: "2024-02-30",
// "2024-02-30T10:00", "2024-02-30t10:00" and "2024-02-30 10:00" (RFC 3339).
const ISO_DATE_PREFIX = /^(\d{4})-(\d{2})-(\d{2})(?:$|[Tt ])/;

const daysInMonth = (year: number, month: number) =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

/**
 * Date doesn't reject days that don't exist ("2024-02-30" becomes March 1),
 * so ISO calendar dates are checked first.
 */
export const isExistingIsoDate = (text: string): boolean => {
  const match = ISO_DATE_PREFIX.exec(text);
  if (!match) return true;
  const [, year, month, day] = match.map(Number);
  return (
    month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month)
  );
};

export const coerceDate = (value: Date | string | number): unknown => {
  if (isBlank(value)) return "";
  if (typeof value === "string") {
    const text = value.trim();
    return isExistingIsoDate(text) ? new Date(text) : new Date(Number.NaN);
  }
  return typeof value === "number" ? new Date(value) : value;
};
