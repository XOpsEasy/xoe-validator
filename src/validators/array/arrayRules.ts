import { createRule, ruleMessage } from "../../core/rule.ts";
import * as en from "../../core/english.ts";
import { getOwn } from "../../core/ownProperties.ts";

export const minLength = (min: number, message?: string) =>
  createRule<unknown[]>({
    code: "array.minLength",
    params: { min },
    check: (value) => value.length >= min,
    ...ruleMessage(message, en.arrayMinLength(min)),
  });

/**
 * Checked before the items: a too long array reports only this issue, and
 * its items aren't validated (which bounds the work for untrusted input).
 */
export const maxLength = (max: number, message?: string) =>
  createRule<unknown[]>({
    code: "array.maxLength",
    params: { max },
    beforeChildren: true,
    check: (value) => value.length <= max,
    ...ruleMessage(message, en.arrayMaxLength(max)),
  });

export const length = (exact: number, message?: string) =>
  createRule<unknown[]>({
    code: "array.length",
    params: { length: exact },
    check: (value) => value.length === exact,
    ...ruleMessage(message, en.arrayLength(exact)),
  });

export const unique = (message?: string) =>
  createRule<unknown[]>({
    code: "array.unique",
    check: (value) => new Set(value).size === value.length,
    ...ruleMessage(message, en.unique),
  });

export const nonEmpty = (message?: string) =>
  createRule<unknown[]>({
    code: "array.nonEmpty",
    check: (value) => value.length > 0,
    ...ruleMessage(message, en.nonEmpty),
  });

/** Elements are unique by a key (e.g. "id") or a selector; selected values are compared with ===. */
export const uniqueBy = (
  key: string | ((item: unknown) => unknown),
  message?: string,
) => {
  const select =
    typeof key === "function"
      ? key
      : (item: unknown) =>
          typeof item === "object" && item !== null
            ? getOwn(item as Record<string, unknown>, key)
            : undefined;

  return createRule<unknown[]>({
    code: "array.uniqueBy",
    params: typeof key === "string" ? { key } : undefined,
    check: (value) => new Set(value.map(select)).size === value.length,
    ...ruleMessage(
      message,
      en.uniqueBy(typeof key === "string" ? key : undefined),
    ),
  });
};

export const ruleRegistry = /* @__PURE__ */ Object.freeze({
  minLength,
  maxLength,
  length,
  nonEmpty,
  unique,
  uniqueBy,
});
