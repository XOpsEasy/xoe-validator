import {
  defineValidator,
  ExtendedValidator,
} from "../../core/validator/index.ts";
import { NoRules } from "../../core/types.ts";

export type UnknownValidator = ExtendedValidator<unknown, NoRules>;

/** Accepts any value; empty values are still required unless optional(). */
export const createUnknownValidator = /* @__PURE__ */ defineValidator({
  type: "unknown",
  check: (_value): _value is unknown => true,
});
