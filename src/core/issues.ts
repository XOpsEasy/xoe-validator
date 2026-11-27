import { XOEIssue } from "./validatorTypes.ts";
import { getOwn, setOwn } from "./ownProperties.ts";

/**
 * Field errors keyed by dotted path ("user.email", "tags.1"); "" is the
 * validated value itself. Duplicate messages of the same field are merged.
 */
export type XOEFieldErrors = Readonly<Record<string, readonly string[]>>;

export const toFieldErrors = (issues: readonly XOEIssue[]): XOEFieldErrors => {
  // Built in place (linear time); nothing outside sees it before it returns.
  const errors: Record<string, string[]> = {};
  for (const issue of issues) {
    const key = issue.path.join(".");
    const messages = getOwn(errors, key) as string[] | undefined;
    if (!messages) setOwn(errors, key, [issue.message]);
    else if (!messages.includes(issue.message)) messages.push(issue.message);
  }
  return errors;
};
