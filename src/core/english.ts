import {
  formatBytes,
  formatDate,
  formatList,
  formatNumber,
  formatValue,
  formatValues,
} from "./format.ts";
import { getOwn } from "./ownProperties.ts";

// The English messages, in one place: the built-in rules use them as their
// default messages and enMessages for localizeIssues, so both say the same.

const num = (value: unknown) => formatNumber(value, ".");
const day = (value: unknown) =>
  formatDate(value, (d, month, year) => `${year}-${month}-${d}`);
const bytes = (value: unknown) => formatBytes(value, ".");
/** "1 character", "3 characters" */
const count = (n: unknown, one: string, other: string) =>
  `${num(n)} ${n === 1 ? one : other}`;

const TYPE_NAMES: Record<string, string> = {
  string: "text",
  number: "a number",
  boolean: "true or false",
  date: "a valid date",
  array: "a list",
  tuple: "a list",
  object: "an object",
  file: "a file",
  null: "null",
};

export const required = "This field is required.";
export const type = (expected: unknown) =>
  `Value must be ${
    getOwn(TYPE_NAMES, String(expected)) ?? `of type ${expected}`
  }.`;
export const literal = (expected: unknown) =>
  `Value must be ${formatValue(expected)}.`;
export const enumOf = (options: unknown) =>
  `Value must be one of: ${formatValues(options)}.`;
export const union = "Value doesn't match any of the allowed types.";
export const oneOf = "Value matches more than one of the allowed types.";
export const discriminator = (key: unknown, options: unknown) =>
  `Invalid ${key}. Expected one of: ${formatList(options)}.`;
export const sameAs = (field: unknown) => `Value must match ${field}.`;
export const transform = "Invalid value.";
/** The default message of refine and superRefine (code "custom"). */
export const custom = "Validation failed.";

export const stringMinLength = (min: unknown) =>
  `Must be at least ${count(min, "character", "characters")} long.`;
export const stringMaxLength = (max: unknown) =>
  `Must be at most ${count(max, "character", "characters")} long.`;
export const stringLength = (length: unknown) =>
  `Must be exactly ${count(length, "character", "characters")} long.`;
export const regexMatch = "Invalid format.";
export const contains = (substring: unknown) => `Must contain "${substring}".`;
export const startsWith = (prefix: unknown) => `Must start with "${prefix}".`;
export const endsWith = (suffix: unknown) => `Must end with "${suffix}".`;
export const email = "Invalid email address.";
export const url = "Invalid URL.";
export const uuid = "Invalid UUID.";
export const isoDate = "Invalid date.";
export const isoDateTime = "Invalid date and time.";
export const ip = (version: unknown) =>
  version === undefined
    ? "Invalid IP address."
    : `Invalid IPv${version} address.`;
export const digits = "Must contain only digits.";

export const minimum = (min: unknown) =>
  `Must be greater than or equal to ${num(min)}.`;
export const maximum = (max: unknown) =>
  `Must be less than or equal to ${num(max)}.`;
export const exclusiveMinimum = (min: unknown) =>
  `Must be greater than ${num(min)}.`;
export const exclusiveMaximum = (max: unknown) =>
  `Must be less than ${num(max)}.`;
export const numberBetween = (min: unknown, max: unknown) =>
  `Must be between ${num(min)} and ${num(max)}.`;
export const divisibleBy = (divisor: unknown) =>
  `Must be divisible by ${num(divisor)}.`;
export const integer = "Must be a whole number.";
export const positive = "Must be greater than 0.";
export const nonNegative = "Must not be negative.";
export const negative = "Must be less than 0.";
export const maxDecimals = (max: unknown) =>
  max === 0
    ? "Must be a whole number."
    : `Must have at most ${count(max, "decimal place", "decimal places")}.`;
export const safeInteger =
  "Must be a whole number between -9007199254740991 and 9007199254740991.";

export const isTrue = "This must be checked.";

export const isBefore = (date: unknown) => `Must be before ${day(date)}.`;
export const isAfter = (date: unknown) => `Must be after ${day(date)}.`;
export const dateBetween = (min: unknown, max: unknown) =>
  `Must be between ${day(min)} and ${day(max)}.`;
export const inFuture = "Must be in the future.";
export const inPast = "Must be in the past.";
export const minAge = (years: unknown) =>
  `Must be at least ${count(years, "year", "years")} old.`;
export const maxAge = (years: unknown) =>
  `Must be at most ${count(years, "year", "years")} old.`;

export const arrayMinLength = (min: unknown) =>
  `Must have at least ${count(min, "item", "items")}.`;
export const arrayMaxLength = (max: unknown) =>
  `Must have at most ${count(max, "item", "items")}.`;
export const nonEmpty = "Must have at least 1 item.";
export const unique = "Items must be unique.";
export const uniqueBy = (key: unknown) =>
  key === undefined ? unique : `Each item must have a unique "${key}".`;
export const arrayLength = (length: unknown) =>
  `Must have exactly ${count(length, "item", "items")}.`;
export const tupleLength = (length: unknown) =>
  `Must have at most ${count(length, "item", "items")}.`;

export const strict = (allowedKeys: unknown) =>
  `Unknown fields are not allowed. Allowed fields: ${formatList(allowedKeys)}.`;
export const requireOne = "At least one field is required.";
export const duplicateKey = (key: unknown) =>
  `Key "${key}" is used more than once.`;

export const maxSize = (max: unknown) => `File must be at most ${bytes(max)}.`;
export const minSize = (min: unknown) => `File must be at least ${bytes(min)}.`;
export const accept = (types: unknown) =>
  `File type must be one of: ${formatList(types)}.`;

export const jsonSchemaFalse = "No value is allowed here.";

// Serbia (rsRules)
export const rsJmbg = "Invalid JMBG (personal identification number).";
export const rsPib = "Invalid PIB (tax identification number).";
export const rsCompanyNumber =
  "Invalid company registration number (matični broj).";
