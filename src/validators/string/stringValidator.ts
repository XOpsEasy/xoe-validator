import {
  defineValidator,
  ExtendedValidator,
  updateState,
  ValidatorState,
} from "../../core/validator/index.ts";
import { coerceString } from "../../core/coerce.ts";
import { ruleRegistry as stringRules } from "./stringRules.ts";

const stringTransforms = {
  /** Trims the value before it is validated, so "   " counts as empty. */
  trim: (state: ValidatorState): ValidatorState =>
    updateState(state, {
      preprocess: [
        ...state.preprocess,
        (value) => (typeof value === "string" ? value.trim() : value),
      ],
    }),
  /** Converts the value to lower case before it is validated (emails, codes). */
  toLowerCase: (state: ValidatorState): ValidatorState =>
    updateState(state, {
      preprocess: [
        ...state.preprocess,
        (value) => (typeof value === "string" ? value.toLowerCase() : value),
      ],
    }),
  /** Converts the value to upper case before it is validated. */
  toUpperCase: (state: ValidatorState): ValidatorState =>
    updateState(state, {
      preprocess: [
        ...state.preprocess,
        (value) => (typeof value === "string" ? value.toUpperCase() : value),
      ],
    }),
};

export type StringValidator = ExtendedValidator<
  string,
  typeof stringRules,
  typeof stringTransforms
>;

export const createStringValidator = /* @__PURE__ */ defineValidator({
  type: "string",
  check: (value): value is string => typeof value === "string",
  rules: stringRules,
  transforms: stringTransforms,
  coerce: coerceString,
});
