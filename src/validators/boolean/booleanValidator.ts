import {
  defineValidator,
  ExtendedValidator,
} from "../../core/validator/index.ts";
import { coerceBoolean } from "../../core/coerce.ts";
import { ruleRegistry as booleanRules } from "./booleanRules.ts";

export type BooleanValidator = ExtendedValidator<boolean, typeof booleanRules>;

export const createBooleanValidator = /* @__PURE__ */ defineValidator({
  type: "boolean",
  check: (value): value is boolean => typeof value === "boolean",
  rules: booleanRules,
  coerce: coerceBoolean,
});
