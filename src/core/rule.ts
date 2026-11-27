import {
  MaybePromise,
  XOEContext,
  XOEData,
  XOEIssue,
  XOEPath,
  XOEValidationOutput,
} from "./validatorTypes.ts";
import { xoeError, xoeSuccess } from "./result.ts";
import { isEmpty } from "./empty.ts";

/**
 * Passed to rule checks as the third argument. It is shared between checks,
 * so it is read-only (frozen at runtime).
 */
export type RuleContext = {
  /** Aborts with validateAsync(value, { signal }); pass it on, e.g. to fetch. */
  readonly signal?: AbortSignal;
  /** Whether a value counts as empty with the current emptyValues option. */
  readonly isEmpty: (value: unknown) => boolean;
};

/** An issue returned by superRefine; code defaults to the rule's code. */
export type XOEIssueInput = {
  message: string;
  code?: string;
  /** Relative to the validated value, e.g. ["shifts", 2, "end"]. */
  path?: XOEPath;
  params?: Record<string, unknown>;
};

/**
 * true (or an empty list / undefined) is valid; false reports the rule's
 * issue; a list reports those issues (superRefine).
 */
export type RuleResult = boolean | readonly XOEIssueInput[] | void;

export type RuleConfig<T> = {
  code: string;
  message: string;
  /** The message was passed in by the user, so localizeIssues keeps it. */
  customMessage?: boolean;
  params?: Record<string, unknown>;
  check: (
    value: T,
    data: XOEData | undefined,
    context: RuleContext,
  ) => MaybePromise<RuleResult>;
  async?: boolean;
  /** Reports the issue on a nested value, relative to the validated value (e.g. ["endDate"]). */
  path?: XOEPath;
  /**
   * @internal Runs before nested values (array items) and skips them when it
   * fails, e.g. array maxLength, so a too long array isn't validated item by
   * item. Only for sync rules that don't need the parsed output.
   */
  beforeChildren?: boolean;
};

export type RuleWithConfig<T> = {
  config: RuleConfig<T>;
  /** Runs the rule on its own, outside of a validator. */
  execute: (
    value: T,
    ctx?: Partial<XOEContext>,
  ) => MaybePromise<XOEValidationOutput<T>>;
};

/**
 * Any rule. `any` because a rule's check takes its value as a parameter, so a
 * RuleWithConfig<string> is not a RuleWithConfig<unknown>.
 */
// oxlint-disable-next-line typescript/no-explicit-any
export type AnyRule = RuleWithConfig<any>;

export type RuleRegistry = Record<string, (...args: never[]) => AnyRule>;

export const isPromise = <T>(value: unknown): value is Promise<T> =>
  typeof (value as Promise<T> | undefined)?.then === "function";

export const createIssue = (
  code: string,
  message: string,
  path: XOEContext["path"],
  params?: Record<string, unknown>,
  customMessage?: boolean,
): XOEIssue => {
  const issue: XOEIssue = params
    ? { code, message, params, path }
    : { code, message, path };
  return customMessage ? { ...issue, customMessage: true } : issue;
};

/**
 * The message of a built-in rule or validator: the one passed in (kept by
 * localizeIssues), or the default.
 */
export const ruleMessage = (
  message: string | undefined,
  fallback: string,
): { message: string; customMessage?: boolean } =>
  message === undefined
    ? { message: fallback }
    : { message, customMessage: true };

/**
 * An issue with the first message given (errorMessage, then the method's
 * own), or the default one.
 */
export const issueWithMessage = (
  code: string,
  messages: readonly (string | undefined)[],
  fallback: string,
  path: XOEContext["path"],
  params?: Record<string, unknown>,
): XOEIssue => {
  const given = messages.find((message) => message !== undefined);
  return createIssue(
    code,
    given ?? fallback,
    path,
    params,
    given !== undefined,
  );
};

/**
 * The options of rules that take a message or an options object, e.g.
 * inFuture("...") or inFuture({ message, now }).
 */
export const optionsOf = <O extends { message?: string }>(
  options: string | O | undefined,
): Partial<O> =>
  typeof options === "string"
    ? ({ message: options } as Partial<O>)
    : (options ?? {});

/** `message` (errorMessage) replaces the rule's message if given. */
export const ruleIssue = <T>(
  config: RuleConfig<T>,
  path: XOEContext["path"],
  message?: string,
): XOEIssue =>
  createIssue(
    config.code,
    message ?? config.message,
    config.path ? [...path, ...config.path] : path,
    config.params,
    message !== undefined || config.customMessage,
  );

/**
 * The issues of a rule result; `message` (errorMessage) replaces every message
 * if given. Messages of superRefine issues are defaults of their codes.
 */
export const ruleIssues = <T>(
  config: RuleConfig<T>,
  result: RuleResult,
  path: XOEContext["path"],
  message?: string,
): XOEIssue[] => {
  if (result === true || result === undefined) return [];
  if (result === false) return [ruleIssue(config, path, message)];
  return result.map((issue) =>
    createIssue(
      issue.code ?? config.code,
      message ?? issue.message,
      issue.path ? [...path, ...issue.path] : path,
      issue.params,
      message !== undefined,
    ),
  );
};

// Rules made by refine, refineAsync, superRefine and superRefineAsync: their
// code may be a built-in one, but toJsonSchema must not read them as such.
const refinements = /* @__PURE__ */ new WeakSet<RuleConfig<never>>();

export const markRefinement = <T>(
  rule: RuleWithConfig<T>,
): RuleWithConfig<T> => {
  refinements.add(rule.config as RuleConfig<never>);
  return rule;
};

export const isRefinement = (config: RuleConfig<never>): boolean =>
  refinements.has(config);

const RULE_CONTEXT: RuleContext = Object.freeze({ isEmpty });

export const createRule = <T>(input: RuleConfig<T>): RuleWithConfig<T> => {
  // A frozen copy, so changing the object passed in can't change the rule.
  // Getters (e.g. a message that depends on the language) are copied as
  // getters. params is copied but not frozen: issues share it, as before.
  const copy = Object.defineProperties(
    {},
    Object.getOwnPropertyDescriptors(input),
  ) as RuleConfig<T>;
  const params = Object.getOwnPropertyDescriptor(input, "params");
  if (params && "value" in params && params.value) {
    Object.defineProperty(copy, "params", {
      ...params,
      value: { ...params.value },
    });
  }
  const config = Object.freeze(copy);
  const execute: RuleWithConfig<T>["execute"] = (value, ctx = {}) => {
    const toResult = (result: RuleResult): XOEValidationOutput<T> => {
      const issues = ruleIssues(config, result, ctx.path ?? []);
      return issues.length > 0 ? xoeError(issues) : xoeSuccess(value);
    };

    const result = config.check(value, ctx.data, RULE_CONTEXT);
    return isPromise<RuleResult>(result)
      ? result.then(toResult)
      : toResult(result);
  };

  return { config, execute };
};
