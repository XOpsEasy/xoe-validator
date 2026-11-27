import { XOEIssue } from "./validatorTypes.ts";
import { getOwn, hasOwn } from "./ownProperties.ts";

/** A template with {param} placeholders, or a function of the issue. */
export type XOEMessage = string | ((issue: XOEIssue) => string);

/**
 * Messages keyed by issue code ("string.minLength") or by field and code
 * ("pin:string.length"); the field specific key wins.
 */
export type XOEMessages = Record<string, XOEMessage>;

const formatParam = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(formatParam).join(", ");
  return String(value);
};

const interpolate = (template: string, params: XOEIssue["params"] = {}) =>
  template.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    hasOwn(params, name) ? formatParam(params[name]) : placeholder,
  );

/**
 * Returns the issues with messages from the catalog. Issues without a matching
 * entry, and issues with a message you passed in (customMessage), keep their
 * message. Pure: pick the catalog per request or per locale.
 */
export const localizeIssues = (
  issues: readonly XOEIssue[],
  messages: XOEMessages,
): readonly XOEIssue[] =>
  issues.map((issue) => {
    if (issue.customMessage) return issue;
    const fieldKey = `${issue.path.join(".")}:${issue.code}`;
    const message = (getOwn(messages, fieldKey) ??
      getOwn(messages, issue.code)) as XOEMessage | undefined;
    if (message === undefined) return issue;

    return {
      ...issue,
      message:
        typeof message === "function"
          ? message(issue)
          : interpolate(message, issue.params),
    };
  });
