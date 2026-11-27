import {
  defineValidator,
  ExtendedValidator,
} from "../../core/validator/index.ts";
import { coerceDate } from "../../core/coerce.ts";
import { isValidDate } from "../../core/typeName.ts";
import { ruleRegistry as dateRules } from "./dateRules.ts";

export type DateValidator = ExtendedValidator<Date, typeof dateRules>;

export const createDateValidator = /* @__PURE__ */ defineValidator({
  type: "date",
  check: isValidDate,
  rules: dateRules,
  coerce: coerceDate,
});
