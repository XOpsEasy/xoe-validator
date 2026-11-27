import { createRule, ruleMessage } from "../../core/rule.ts";
import * as en from "../../core/english.ts";

export const maxSize = (bytes: number, message?: string) =>
  createRule<File>({
    code: "file.maxSize",
    params: { max: bytes },
    check: (file) => file.size <= bytes,
    ...ruleMessage(message, en.maxSize(bytes)),
  });

export const minSize = (bytes: number, message?: string) =>
  createRule<File>({
    code: "file.minSize",
    params: { min: bytes },
    check: (file) => file.size >= bytes,
    ...ruleMessage(message, en.minSize(bytes)),
  });

/** Matches a MIME type ("application/pdf"), a group ("image/*") or an extension (".pdf"). */
const matches = (file: File, pattern: string): boolean => {
  const type = file.type.toLowerCase();
  const rule = pattern.trim().toLowerCase();
  if (rule.startsWith(".")) return file.name.toLowerCase().endsWith(rule);
  if (rule.endsWith("/*")) return type.startsWith(rule.slice(0, -1));
  return type === rule;
};

/** Allowed file types, as in the HTML accept attribute. */
export const accept = (types: string[], message?: string) => {
  // A frozen copy: changing the list passed in can't change the rule.
  const allowed = Object.freeze([...types]);
  return createRule<File>({
    code: "file.accept",
    params: { types: allowed },
    check: (file) => allowed.some((pattern) => matches(file, pattern)),
    ...ruleMessage(message, en.accept(allowed)),
  });
};

export const ruleRegistry = /* @__PURE__ */ Object.freeze({
  maxSize,
  minSize,
  accept,
});
