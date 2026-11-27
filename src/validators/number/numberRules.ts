import { createRule, ruleMessage } from "../../core/rule.ts";
import * as en from "../../core/english.ts";

export const minimum = (min: number, message?: string) =>
  createRule<number>({
    code: "number.minimum",
    params: { min },
    check: (value) => value >= min,
    ...ruleMessage(message, en.minimum(min)),
  });

export const maximum = (max: number, message?: string) =>
  createRule<number>({
    code: "number.maximum",
    params: { max },
    check: (value) => value <= max,
    ...ruleMessage(message, en.maximum(max)),
  });

export const divisibleBy = (divisor: number, message?: string) =>
  createRule<number>({
    code: "number.divisibleBy",
    params: { divisor },
    check: (value) => value % divisor === 0,
    ...ruleMessage(message, en.divisibleBy(divisor)),
  });

export const between = (min: number, max: number, message?: string) =>
  createRule<number>({
    code: "number.between",
    params: { min, max },
    check: (value) => value >= min && value <= max,
    ...ruleMessage(message, en.numberBetween(min, max)),
  });

export const integer = (message?: string) =>
  createRule<number>({
    code: "number.integer",
    check: (value) => Number.isInteger(value),
    ...ruleMessage(message, en.integer),
  });

export const positive = (message?: string) =>
  createRule<number>({
    code: "number.positive",
    check: (value) => value > 0,
    ...ruleMessage(message, en.positive),
  });

export const nonNegative = (message?: string) =>
  createRule<number>({
    code: "number.nonNegative",
    check: (value) => value >= 0,
    ...ruleMessage(message, en.nonNegative),
  });

export const negative = (message?: string) =>
  createRule<number>({
    code: "number.negative",
    check: (value) => value < 0,
    ...ruleMessage(message, en.negative),
  });

/** Greater than `min` (exclusive; minimum is inclusive). */
export const greaterThan = (min: number, message?: string) =>
  createRule<number>({
    code: "number.exclusiveMinimum",
    params: { min },
    check: (value) => value > min,
    ...ruleMessage(message, en.exclusiveMinimum(min)),
  });

/** Less than `max` (exclusive; maximum is inclusive). */
export const lessThan = (max: number, message?: string) =>
  createRule<number>({
    code: "number.exclusiveMaximum",
    params: { max },
    check: (value) => value < max,
    ...ruleMessage(message, en.exclusiveMaximum(max)),
  });

/** Decimal places of a number as written in JavaScript (1e-7 has 7). */
const decimalPlaces = (value: number): number => {
  const [mantissa, exponent = "0"] = String(Math.abs(value)).split("e");
  const fraction = mantissa.split(".")[1] ?? "";
  return Math.max(0, fraction.length - Number(exponent));
};

/**
 * At most `max` decimal places, e.g. maxDecimals(2) for amounts. Unlike
 * divisibleBy(0.01), it isn't affected by floating point (0.29 % 0.01 != 0).
 */
export const maxDecimals = (max: number, message?: string) =>
  createRule<number>({
    code: "number.maxDecimals",
    params: { max },
    check: (value) => decimalPlaces(value) <= max,
    ...ruleMessage(message, en.maxDecimals(max)),
  });

/**
 * A whole number that JavaScript represents exactly (up to 2^53 - 1), e.g.
 * for IDs: larger numbers silently lose precision.
 */
export const safeInteger = (message?: string) =>
  createRule<number>({
    code: "number.safeInteger",
    check: (value) => Number.isSafeInteger(value),
    ...ruleMessage(message, en.safeInteger),
  });

export const ruleRegistry = /* @__PURE__ */ Object.freeze({
  minimum,
  maximum,
  between,
  divisibleBy,
  integer,
  positive,
  nonNegative,
  negative,
  greaterThan,
  lessThan,
  maxDecimals,
  safeInteger,
});
