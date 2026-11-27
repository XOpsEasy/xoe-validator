import { createRule, ruleMessage } from "../../core/rule.ts";
import * as en from "../../core/english.ts";

export const isTrue = (message?: string) =>
  createRule<boolean>({
    code: "boolean.isTrue",
    check: (value) => value === true,
    ...ruleMessage(message, en.isTrue),
  });

export const ruleRegistry = /* @__PURE__ */ Object.freeze({
  isTrue,
});
