import { XOEIssue } from "./validatorTypes.ts";
import { isValidDate } from "./typeName.ts";

/** The params of an issue, for message functions. */
export const paramsOf = (issue: XOEIssue): Readonly<Record<string, unknown>> =>
  issue.params ?? {};

/** Formats a number with the locale's decimal separator, without grouping. */
export const formatNumber = (value: unknown, decimal: string): string =>
  typeof value === "number"
    ? String(value).replace(".", decimal)
    : String(value);

const pad = (part: number) => String(part).padStart(2, "0");

// A Date after JSON.stringify, e.g. in issues an API sent to the frontend.
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

const dateOf = (value: unknown): Date | undefined => {
  if (isValidDate(value)) return value;
  if (typeof value !== "string" || !ISO_TIMESTAMP.test(value)) return undefined;
  const date = new Date(value);
  return isValidDate(date) ? date : undefined;
};

/**
 * Formats a date (or a date that went through JSON) in the runtime's time
 * zone (the user's on the frontend): the date, plus the time when it isn't
 * midnight.
 */
export const formatDate = (
  input: unknown,
  date: (day: string, month: string, year: number) => string,
): string => {
  const value = dateOf(input);
  if (!value) return String(input);
  const day = date(
    pad(value.getDate()),
    pad(value.getMonth() + 1),
    value.getFullYear(),
  );
  return value.getHours() === 0 && value.getMinutes() === 0
    ? day
    : `${day} ${pad(value.getHours())}:${pad(value.getMinutes())}`;
};

/** 1536 -> "1.5 KB" (or "1,5 KB" with decimal ","). */
export const formatBytes = (bytes: unknown, decimal: string): string => {
  if (typeof bytes !== "number") return String(bytes);
  const [value, unit] =
    bytes >= 1024 * 1024
      ? [bytes / 1024 / 1024, "MB"]
      : bytes >= 1024
        ? [bytes / 1024, "KB"]
        : [bytes, "B"];
  return `${formatNumber(+value.toFixed(1), decimal)} ${unit}`;
};

/** One value as JSON: "a" -> "a", [1, 2] -> [1,2]. */
export const formatValue = (value: unknown): string => JSON.stringify(value);

/** Values as a quoted list: ["a", 1] -> "a", 1. */
export const formatValues = (values: unknown): string =>
  Array.isArray(values)
    ? values.map((value) => JSON.stringify(value)).join(", ")
    : JSON.stringify(values);

/** Names as a plain list: ["a", "b"] -> a, b. */
export const formatList = (values: unknown): string =>
  Array.isArray(values) ? values.join(", ") : String(values);
