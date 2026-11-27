import {
  defineValidator,
  ExtendedValidator,
} from "../../core/validator/index.ts";
import { coerceNumber } from "../../core/coerce.ts";
import { ruleRegistry as numberRules } from "./numberRules.ts";

export type NumberValidator = ExtendedValidator<number, typeof numberRules>;

export const createNumberValidator = /* @__PURE__ */ defineValidator({
  type: "number",
  check: (value): value is number =>
    typeof value === "number" && Number.isFinite(value),
  rules: numberRules,
  coerce: coerceNumber,
});
