import { StandardSchemaV1 } from "../standardSchema.ts";
import { XOEUsageError } from "../errors.ts";
import {
  MaybePromise,
  XOEContext,
  XOEData,
  XOEIssue,
  XOEValidationOutput,
} from "../validatorTypes.ts";
import { xoeError, xoeSuccess } from "../result.ts";
import { createLimit, DEFAULT_CONCURRENCY, Limit } from "../limit.ts";
import {
  AnyRule,
  createIssue,
  isPromise,
  RuleContext,
  ruleIssues as issuesOf,
  RuleResult,
} from "../rule.ts";
import { isEmpty } from "../empty.ts";
import { typeName } from "../typeName.ts";
import { getOwn, hasOwn } from "../ownProperties.ts";
import * as en from "../english.ts";

/**
 * Which values count as empty: "form" (default) treats undefined, null and ""
 * as empty; "undefined" only undefined, e.g. for JSON APIs where "" and null
 * are values (and for JSON Schema).
 */
export type EmptyValues = "form" | "undefined";

/**
 * Documentation of a value (meta(), describe()): toJsonSchema writes it to
 * the schema, e.g. for OpenAPI. Validation never reads it.
 */
export type XOEAnnotations = Readonly<{
  title?: string;
  description?: string;
  /** Example values; OpenAPI 3.0 gets the first one as `example`. */
  examples?: readonly unknown[];
  deprecated?: boolean;
}>;

export type RunContext = XOEContext & {
  sync: boolean;
  /** Limits how many async rules of the whole tree run at the same time. */
  limit?: Limit;
  /** Cancels async validation (validateAsync(value, { signal })). */
  signal?: AbortSignal;
  /** Applies to the whole subtree. */
  emptyValues?: EmptyValues;
};

/** Result of running a validator: the (possibly transformed) value and its issues. */
export type RunOutput = { value: unknown; issues: XOEIssue[] };

/**
 * Validates nested values (object fields, array items) and builds the output
 * value. Gets the validator state for abortEarly and the messages.
 */
export type Combinator = {
  isAsync: boolean;
  run: (
    // The value passed the type check, so combinators declare its type
    // (e.g. unknown[]); with unknown they couldn't.
    // oxlint-disable-next-line typescript/no-explicit-any
    value: any,
    ctx: RunContext,
    state: ValidatorState,
  ) => MaybePromise<RunOutput>;
  /** What the combinator validates, for introspection (toJsonSchema). */
  meta?: CombinatorMeta;
};

/** Any validator, e.g. a field of a shape or an option of a union. */
export type AnyValidator = Validator<unknown, unknown, boolean>;

/** Read-only description of a combinator's nested validators. */
export type CombinatorMeta =
  | {
      kind: "object";
      shape: Readonly<Record<string, AnyValidator>>;
      unknownKeys: "strip" | "passthrough" | "strict" | "catchall";
      /** Validates the keys that are not in the shape (catchall). */
      catchall?: AnyValidator;
    }
  | {
      kind: "array";
      item?: AnyValidator;
      /** Validators of the first positions (JSON Schema prefixItems). */
      prefix?: readonly AnyValidator[];
    }
  | { kind: "tuple"; items: readonly AnyValidator[] }
  | { kind: "record"; key?: AnyValidator; value: AnyValidator }
  | { kind: "union"; options: readonly AnyValidator[] }
  | {
      kind: "discriminated";
      key: string;
      options: Readonly<Record<string, AnyValidator>>;
    };

/**
 * Read-only description of how a validator is built, for introspection
 * (toJsonSchema). Validation never reads it.
 */
export type ValidatorMeta =
  | { kind: "state"; state: ValidatorState }
  | { kind: "pipe"; first: AnyValidator; next: AnyValidator }
  | { kind: "lazy"; resolve: () => AnyValidator }
  | { kind: "context"; inner: AnyValidator }
  | { kind: "optional"; inner: AnyValidator }
  /** Every option must pass; the output is the first option's (JSON Schema allOf). */
  | { kind: "allOf"; options: readonly AnyValidator[] }
  /** Exactly one option must pass (JSON Schema oneOf). */
  | { kind: "oneOf"; options: readonly AnyValidator[] };

export type ValidatorState = Readonly<{
  type: string;
  typeCheck: (value: unknown) => boolean;
  rules: readonly AnyRule[];
  presence: "required" | "optional";
  typeMessage: string;
  /** typeMessage was passed in by the user (literal(value, message), ...). */
  customTypeMessage?: boolean;
  /**
   * Code and params of the type issue; defaults to "type" with
   * { expected: type, received: the value's type name }.
   */
  typeCode?: string;
  typeParams?: Record<string, unknown>;
  requiredMessage: string;
  /** requiredMessage was passed in by the user (required(message)). */
  customRequiredMessage?: boolean;
  abortEarly: boolean;
  errorMessage?: string;
  children?: Combinator;
  /** Applied to the raw input before anything else (coerce, trim). */
  preprocess: readonly ((value: unknown) => unknown)[];
  /** Used instead of an empty value. */
  defaultValue?: () => unknown;
  /** null is a valid value (nullable()). */
  nullable: boolean;
  /** Returned instead of failing (catch()). */
  fallback?: (issues: XOEIssue[], input: unknown) => unknown;
  /** meta() and describe(); only for documentation (toJsonSchema). */
  annotations?: XOEAnnotations;
  /** Applied to the output when the value is valid. */
  // Each takes the output of the one before, so the types differ per step.
  // oxlint-disable-next-line typescript/no-explicit-any
  transforms: readonly ((value: any) => unknown)[];
}>;

export type ValidateOptions = {
  /** Sibling values for cross-field rules (sameAs) when validating one value. */
  data?: XOEData;
  emptyValues?: EmptyValues;
  /**
   * Adds the invalid value, as it was passed in, to every issue (`input`).
   * For debugging and internal logs: it may contain passwords, tokens or
   * personal data, so don't send such issues to clients.
   */
  reportInput?: boolean;
};

export type ValidateAsyncOptions = ValidateOptions & {
  /**
   * How many async rules (refineAsync, ...) may run at the same time across
   * the whole value. Defaults to 10; use Infinity for no limit.
   */
  concurrency?: number;
  /**
   * Cancels the validation: validateAsync rejects with the signal's reason,
   * queued async rules don't start and running ones get the signal.
   */
  signal?: AbortSignal;
};

/**
 * A validator with output type T and input type I. It is also a Standard
 * Schema (the "~standard" property).
 */
/**
 * validate() arguments: none are accepted for validators that are known to be
 * async, so calling validate() on them is a type error (use validateAsync()).
 */
export type ValidateArgs<A extends boolean> = [A] extends [true]
  ? [useValidateAsync: never]
  : [value: unknown, options?: ValidateOptions];

/**
 * A validator with output type T and input type I. A tells whether it is
 * async: true (has async rules), false (sync), or boolean (not known, e.g. a
 * hand-written Validator<Node> for a recursive schema). It is also a Standard
 * Schema (the "~standard" property).
 */
export type Validator<T, I = T, A extends boolean = boolean> = StandardSchemaV1<
  I,
  T
> & {
  /** Type-only marker of A; not present at runtime. */
  readonly "~async"?: A;
  /**
   * @internal How the validator is built (see ValidatorMeta), for
   * toJsonSchema. Not part of the public API: it may change in any version.
   */
  readonly "~meta"?: ValidatorMeta;
  readonly isAsync: boolean;
  /**
   * Whether the input may be empty: true with optional(), default() or
   * catch(). Useful e.g. to mark required form fields.
   */
  readonly isOptional: boolean;
  /**
   * Validates synchronously. A type error for async validators (use
   * validateAsync); at runtime it throws XOEUsageError ASYNC_IN_SYNC.
   */
  validate(...args: ValidateArgs<A>): XOEValidationOutput<T>;
  validateAsync(
    value: unknown,
    options?: ValidateAsyncOptions,
  ): Promise<XOEValidationOutput<T>>;
  /**
   * @internal Used by parent validators (object, array, union, ...) to run
   * this one with the parent's path and data. Not part of the public API:
   * it may change in any version. Use validate/validateAsync.
   */
  readonly "~run": (value: unknown, ctx: RunContext) => MaybePromise<RunOutput>;
};

/** Whether a validator is async: true, false or boolean (not known). */
export type IsAsync<V> =
  V extends Validator<unknown, unknown, infer A> ? A : boolean;

type AsyncKind<V> = V extends unknown
  ? [IsAsync<V>] extends [true]
    ? "async"
    : [IsAsync<V>] extends [false]
      ? "sync"
      : "unknown"
  : never;

/**
 * Whether a validator built from the union of validators V is async: true if
 * any of them is async, false if all are sync, boolean otherwise.
 */
export type AnyAsync<V> =
  "async" extends AsyncKind<V>
    ? true
    : "unknown" extends AsyncKind<V>
      ? boolean
      : false;

/** true if either is async, false if both are sync, boolean otherwise. */
export type OrAsync<A extends boolean, B extends boolean> = [A] extends [true]
  ? true
  : [B] extends [true]
    ? true
    : [A | B] extends [false]
      ? false
      : boolean;

/** The output type of a validator (after coerce, default and transform). */
export type Infer<V> = V extends Validator<infer T, unknown> ? T : never;

/** The input type of a validator, e.g. string | number for coerce.number(). */
export type InferInput<V> = V extends Validator<unknown, infer I> ? I : never;

export const createState = (
  type: string,
  typeCheck: (value: unknown) => boolean,
  overrides: Partial<ValidatorState> = {},
): ValidatorState => ({
  type,
  typeCheck,
  rules: [],
  presence: "required",
  typeMessage: en.type(type),
  requiredMessage: en.required,
  abortEarly: false,
  nullable: false,
  preprocess: [],
  transforms: [],
  ...overrides,
});

export const updateState = (
  state: ValidatorState,
  patch: Partial<ValidatorState>,
): ValidatorState => ({ ...state, ...patch });

export const addRule = (state: ValidatorState, rule: AnyRule): ValidatorState =>
  updateState(state, { rules: [...state.rules, rule] });

export { isEmpty };

export const isEmptyIn = (ctx: RunContext, value: unknown): boolean =>
  ctx.emptyValues === "undefined" ? value === undefined : isEmpty(value);

export const andThen = <A, B>(
  value: MaybePromise<A>,
  fn: (value: A) => MaybePromise<B>,
): MaybePromise<B> => (isPromise<A>(value) ? value.then(fn) : fn(value));

/** Calls `fn` for each item in order, synchronously when possible; stops when `fn` returns true. */
export const runSequence = <I>(
  items: readonly I[],
  fn: (item: I, index: number) => MaybePromise<boolean>,
): MaybePromise<void> => {
  const step = (start: number): MaybePromise<void> => {
    for (let i = start; i < items.length; i++) {
      const stop = fn(items[i], i);
      if (isPromise<boolean>(stop)) {
        return stop.then((done) => (done ? undefined : step(i + 1)));
      }
      if (stop) return;
    }
  };
  return step(0);
};

/**
 * Runs nested validators (object fields, array items, record entries) and
 * passes each output to `collect` in item order. Async validation without
 * abortEarly runs them in parallel; otherwise they run in order and stop at
 * the first invalid item when abortEarly is set.
 */
export const runChildren = <I>(
  items: readonly I[],
  run: (item: I, index: number) => MaybePromise<RunOutput>,
  collect: (item: I, output: RunOutput, index: number) => void,
  ctx: RunContext,
  abortEarly: boolean,
): MaybePromise<void> => {
  if (ctx.sync) {
    // Sync validation never returns promises: a plain loop is the fastest path.
    for (let i = 0; i < items.length; i++) {
      const output = run(items[i], i) as RunOutput;
      collect(items[i], output, i);
      if (abortEarly && output.issues.length > 0) return;
    }
    return;
  }
  if (abortEarly) {
    return runSequence(items, (item, i) =>
      andThen(run(item, i), (output) => {
        collect(item, output, i);
        return abortEarly && output.issues.length > 0;
      }),
    );
  }

  // A plain loop, so holes of sparse arrays are validated like in the sync
  // path (map and forEach skip them).
  const outputs: MaybePromise<RunOutput>[] = [];
  let pending = false;
  try {
    for (let i = 0; i < items.length; i++) {
      const output = run(items[i], i);
      if (isPromise(output)) pending = true;
      outputs.push(output);
    }
  } catch (error) {
    // A sync throw ends the validation; the promises already started have no
    // reader anymore, so keep their rejections from becoming unhandled.
    for (const output of outputs) {
      if (isPromise(output)) output.catch(() => {});
    }
    throw error;
  }
  if (!pending) {
    for (let i = 0; i < items.length; i++) {
      collect(items[i], outputs[i] as RunOutput, i);
    }
    return;
  }
  return Promise.all(outputs).then((settled) => {
    for (let i = 0; i < items.length; i++) collect(items[i], settled[i], i);
  });
};

/**
 * Appends issues one by one: push(...issues) passes every issue as an
 * argument and throws RangeError for very long lists.
 */
export const appendIssues = (
  target: XOEIssue[],
  issues: readonly XOEIssue[],
): void => {
  for (let i = 0; i < issues.length; i++) target.push(issues[i]);
};

/**
 * The context of a nested value (object field, array item): the same settings
 * with its own path and parent data. Built with a fixed set of properties
 * instead of a spread, which is faster for every field and item.
 */
export const childContext = (
  ctx: RunContext,
  key: string | number,
  data: XOEData | undefined,
): RunContext => ({
  data,
  path: [...ctx.path, key],
  sync: ctx.sync,
  limit: ctx.limit,
  signal: ctx.signal,
  emptyValues: ctx.emptyValues,
});

const asyncError = () =>
  new XOEUsageError(
    "ASYNC_IN_SYNC",
    "xoe: validator contains async rules, use validateAsync() instead of validate().",
  );

const isAsyncInSync = (error: unknown) =>
  error instanceof XOEUsageError && error.code === "ASYNC_IN_SYNC";

/**
 * In sync validation a promise means async work that validate() can't wait
 * for: fail with a clear error and keep the promise from becoming an
 * unhandled rejection.
 */
const assertSync = <T>(value: MaybePromise<T>, ctx: RunContext): T => {
  if (ctx.sync && isPromise(value)) {
    value.catch(() => {});
    throw asyncError();
  }
  return value as T;
};

const isUndefined = (value: unknown) => value === undefined;

// Rule contexts are shared by every check (no allocation per check), so they
// are frozen: a check can't change what the next one gets.
const FORM_RULE_CONTEXT: RuleContext = Object.freeze({ isEmpty });
const UNDEFINED_RULE_CONTEXT: RuleContext = Object.freeze({
  isEmpty: isUndefined,
});

const ruleContextOf = (ctx: RunContext): RuleContext => {
  const base =
    ctx.emptyValues === "undefined"
      ? UNDEFINED_RULE_CONTEXT
      : FORM_RULE_CONTEXT;
  return ctx.signal ? Object.freeze({ ...base, signal: ctx.signal }) : base;
};

type SplitRules = {
  /** All sync rules. */
  syncRules: readonly AnyRule[];
  /** Sync rules without those that run before nested values. */
  syncMainRules: readonly AnyRule[];
  asyncRules: readonly AnyRule[];
};

// Rule lists are immutable, so their split is computed once per list.
const splitCache = /* @__PURE__ */ new WeakMap<
  readonly AnyRule[],
  SplitRules
>();

const splitRules = (rules: readonly AnyRule[]): SplitRules => {
  let split = splitCache.get(rules);
  if (!split) {
    const syncRules = rules.filter((rule) => !rule.config.async);
    split = {
      syncRules,
      syncMainRules: syncRules.filter((rule) => !rule.config.beforeChildren),
      asyncRules: rules.filter((rule) => rule.config.async),
    };
    splitCache.set(rules, split);
  }
  return split;
};

const runRules = (
  state: ValidatorState,
  value: unknown,
  ctx: RunContext,
): MaybePromise<XOEIssue[]> => {
  const issues: XOEIssue[] = [];
  // Returns true when validation of this value should stop (abortEarly).
  const report = (rule: AnyRule, result: RuleResult): boolean => {
    if (result === true || result === undefined) return false; // fast path
    const ruleIssues = issuesOf(
      rule.config,
      result,
      ctx.path,
      state.errorMessage,
    );
    appendIssues(issues, ruleIssues);
    return ruleIssues.length > 0 && state.abortEarly;
  };

  if (state.rules.length === 0) return issues;
  const ruleContext = ruleContextOf(ctx);
  // Rules such as array maxLength already ran before the nested values; a
  // validator without nested values runs them here with the others.
  const skipPreRules = state.children !== undefined;

  if (ctx.sync) {
    for (const rule of state.rules) {
      if (skipPreRules && rule.config.beforeChildren) continue;
      if (rule.config.async) throw asyncError();
      const result = rule.config.check(value, ctx.data, ruleContext);
      if (isPromise<RuleResult>(result)) assertSync(result, ctx);
      if (report(rule, result as RuleResult)) break;
    }
    return issues;
  }

  // Async rules wait for a free slot of the concurrency limit and don't start
  // after the validation was aborted.
  const check = (rule: AnyRule) => {
    if (!rule.config.async) {
      return rule.config.check(value, ctx.data, ruleContext);
    }
    const start = () => {
      throwIfAborted(ctx.signal);
      return rule.config.check(value, ctx.data, ruleContext);
    };
    return ctx.limit ? ctx.limit(start) : start();
  };

  // In order (stopping at the first issue) with abortEarly, else in parallel.
  const runStage = (rules: readonly AnyRule[]): MaybePromise<void> => {
    if (state.abortEarly) {
      return runSequence(rules, (rule) =>
        andThen(check(rule), (result) => report(rule, result)),
      );
    }
    const results = rules.map(check);
    const reportAll = (settled: readonly RuleResult[]) => {
      settled.forEach((result, i) => report(rules[i], result));
    };
    return results.some((result) => isPromise(result))
      ? Promise.all(results).then(reportAll)
      : reportAll(results as RuleResult[]);
  };

  // Async rules (refineAsync, ...) only run when the other rules passed, so an
  // "email is taken" API call never receives an invalid email.
  const split = splitRules(state.rules);
  const syncRules = skipPreRules ? split.syncMainRules : split.syncRules;
  const { asyncRules } = split;
  return andThen(runStage(syncRules), () =>
    issues.length > 0 || asyncRules.length === 0
      ? issues
      : andThen(runStage(asyncRules), () => issues),
  );
};

const typeIssue = (
  state: ValidatorState,
  value: unknown,
  path: RunContext["path"],
) =>
  createIssue(
    state.typeCode ?? "type",
    state.errorMessage ?? state.typeMessage,
    path,
    state.typeParams ?? { expected: state.type, received: typeName(value) },
    state.errorMessage !== undefined || state.customTypeMessage,
  );

export const requiredIssue = (
  state: ValidatorState,
  path: RunContext["path"],
) =>
  createIssue(
    "required",
    state.errorMessage ?? state.requiredMessage,
    path,
    undefined,
    state.errorMessage !== undefined || state.customRequiredMessage,
  );

/**
 * An empty optional value is returned as is, unless "" is not a valid value
 * of the type or transforms follow: they don't run for it, so "" would end up
 * outside their output type.
 */
const emptyOutput = (state: ValidatorState, value: unknown): unknown =>
  value === "" && (state.transforms.length > 0 || !state.typeCheck(value))
    ? undefined
    : value;

const transformIssue = (state: ValidatorState, path: RunContext["path"]) =>
  createIssue(
    "transform",
    state.errorMessage ?? en.transform,
    path,
    undefined,
    state.errorMessage !== undefined,
  );

/**
 * Runs the transforms in order. A transform that throws reports a
 * "transform" issue (invalid data never throws); async transforms are awaited
 * by validateAsync (validate throws) and their rejections are passed on, like
 * rejected async checks. The input goes to the first transform as is, even
 * when it is a promise.
 */
const applyTransforms = (
  state: ValidatorState,
  value: unknown,
  ctx: RunContext,
): MaybePromise<RunOutput> => {
  const step = (current: unknown, start: number): MaybePromise<RunOutput> => {
    for (let i = start; i < state.transforms.length; i++) {
      let next: unknown;
      try {
        next = state.transforms[i](current);
      } catch {
        return { value: current, issues: [transformIssue(state, ctx.path)] };
      }
      if (isPromise<unknown>(next)) {
        assertSync(next, ctx);
        const index = i + 1;
        return next.then((resolved) => step(resolved, index));
      }
      current = next;
    }
    return { value: current, issues: [] };
  };
  return step(value, 0);
};

export const runValidator = (
  state: ValidatorState,
  input: unknown,
  ctx: RunContext,
): MaybePromise<RunOutput> => {
  const output = runInput(state, input, ctx);
  if (!state.fallback) return output;

  // catch(): an invalid value becomes the fallback (may be async like
  // default). The fallback has the type before transform(), so the
  // transforms run on it too.
  const fallback = state.fallback;
  return andThen(output, (result) =>
    result.issues.length === 0
      ? result
      : andThen(
          assertSync(fallback(result.issues, input), ctx),
          (value): MaybePromise<RunOutput> =>
            state.transforms.length === 0
              ? { value, issues: [] }
              : applyTransforms(state, value, ctx),
        ),
  );
};

/**
 * Runs the preprocess functions (coerce, trim). One that throws leaves the
 * value as it was, so the type check reports it, as coerce does for values
 * it can't convert.
 */
const preprocess = (state: ValidatorState, input: unknown): unknown => {
  let current = input;
  for (const fn of state.preprocess) {
    try {
      current = fn(current);
    } catch {
      // Keep the value unchanged.
    }
  }
  return current;
};

const runInput = (
  state: ValidatorState,
  input: unknown,
  ctx: RunContext,
): MaybePromise<RunOutput> => {
  const preprocessed =
    state.preprocess.length === 0 ? input : preprocess(state, input);
  // default() replaces empty values and null (also with nullable() or
  // emptyValues "undefined"), so a validator with a default never returns null.
  if (
    !state.defaultValue ||
    (preprocessed !== null && !isEmptyIn(ctx, preprocessed))
  ) {
    return runPresent(state, preprocessed, ctx);
  }
  // The default may be async (validateAsync waits for it, validate throws).
  return andThen(assertSync(state.defaultValue(), ctx), (value) =>
    runPresent(state, value, ctx),
  );
};

const runPresent = (
  state: ValidatorState,
  value: unknown,
  ctx: RunContext,
): MaybePromise<RunOutput> => {
  if (value === null && state.nullable) return { value, issues: [] };
  if (isEmptyIn(ctx, value)) {
    return state.presence === "optional"
      ? { value: emptyOutput(state, value), issues: [] }
      : { value, issues: [requiredIssue(state, ctx.path)] };
  }
  if (!state.typeCheck(value)) {
    return { value, issues: [typeIssue(state, value, ctx.path)] };
  }

  const finish = (output: RunOutput): MaybePromise<RunOutput> =>
    output.issues.length > 0 || state.transforms.length === 0
      ? output
      : applyTransforms(state, output.value, ctx);
  const runOwnRules = (current: unknown) =>
    andThen(runRules(state, current, ctx), (issues) =>
      finish({ value: current, issues }),
    );

  // Nested values are validated first, so the validator's own rules
  // (refine, requireOne, ...) see the parsed output, not the raw input.
  const { children } = state;
  if (!children) return runOwnRules(value);
  // Rules such as array maxLength run first: a too long array isn't
  // validated item by item.
  if (state.rules.length > 0) {
    const issues = runPreRules(state, value, ctx);
    if (issues) return { value, issues };
  }
  return andThen(children.run(value, ctx, state), (child) =>
    child.issues.length > 0 ? child : runOwnRules(child.value),
  );
};

/** The issues of the beforeChildren rules, or undefined when they pass. */
const runPreRules = (
  state: ValidatorState,
  value: unknown,
  ctx: RunContext,
): XOEIssue[] | undefined => {
  let issues: XOEIssue[] | undefined;
  for (const rule of state.rules) {
    if (!rule.config.beforeChildren) continue;
    const result = rule.config.check(
      value,
      ctx.data,
      ruleContextOf(ctx),
    ) as RuleResult;
    if (result === true || result === undefined) continue;
    const ruleIssues = issuesOf(
      rule.config,
      result,
      ctx.path,
      state.errorMessage,
    );
    if (ruleIssues.length === 0) continue;
    issues ??= [];
    appendIssues(issues, ruleIssues);
    if (state.abortEarly) break;
  }
  return issues;
};

export const isAsyncState = (state: ValidatorState): boolean =>
  state.rules.some((rule) => rule.config.async) ||
  Boolean(state.children?.isAsync);

const syncContext = (options: ValidateOptions = {}): RunContext => ({
  data: options.data,
  path: [],
  sync: true,
  emptyValues: options.emptyValues,
});

const asyncContext = (options: ValidateAsyncOptions = {}): RunContext => ({
  data: options.data,
  path: [],
  sync: false,
  emptyValues: options.emptyValues,
  limit: createLimit(options.concurrency ?? DEFAULT_CONCURRENCY),
  signal: options.signal,
});

/**
 * For the Standard Schema interface of validators without async rules: may
 * return promises (async transforms, defaults, catch) but answers
 * synchronously when nothing is async.
 */
const maybeAsyncContext = (): RunContext => ({ path: [], sync: false });

const abortReason = (signal: AbortSignal): unknown =>
  signal.reason ??
  new DOMException("The validation was aborted.", "AbortError");

const throwIfAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) throw abortReason(signal);
};

/** Rejects as soon as the signal aborts, even if `work` keeps running. */
const abortable = <T>(work: MaybePromise<T>, signal?: AbortSignal) => {
  if (!signal) return work;
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(abortReason(signal));
    signal.addEventListener("abort", onAbort, { once: true });
    Promise.resolve(work)
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", onAbort));
  });
};

/** The value at an issue's path in the input; undefined if it's missing. */
const inputAt = (input: unknown, path: XOEIssue["path"]): unknown =>
  path.reduce<unknown>(
    (node, key) =>
      typeof node === "object" && node !== null
        ? getOwn(node as Record<string, unknown>, String(key))
        : undefined,
    input,
  );

/** The input of an issue: the key for record key issues, else the value. */
const issueInput = (input: unknown, issue: XOEIssue): unknown =>
  issue.params && hasOwn(issue.params, "recordKey")
    ? issue.params.recordKey
    : inputAt(input, issue.path);

const toOutput = <T>(
  { value, issues }: RunOutput,
  input: unknown,
  options?: ValidateOptions,
): XOEValidationOutput<T> => {
  if (issues.length === 0) return xoeSuccess(value as T);
  // Added at the end, so validation itself doesn't pay for it.
  return xoeError(
    options?.reportInput
      ? issues.map((issue) => ({ ...issue, input: issueInput(input, issue) }))
      : issues,
  );
};

export const createBaseValidator = <T, I = T, A extends boolean = boolean>(
  state: ValidatorState,
): Validator<T, I, A> =>
  createValidator<T, I, A>(
    (value, ctx) => runValidator(state, value, ctx),
    {
      // A getter, so recursive (lazy) validators are only inspected when used.
      get isAsync() {
        return isAsyncState(state);
      },
      isOptional:
        state.presence === "optional" ||
        state.defaultValue !== undefined ||
        state.fallback !== undefined,
    },
    { kind: "state", state },
  );

/**
 * Builds a validator from a run function (for validators that wrap others,
 * e.g. withContext). `inner` provides isAsync and isOptional.
 */
export const createValidator = <T, I = T, A extends boolean = boolean>(
  run: (value: unknown, ctx: RunContext) => MaybePromise<RunOutput>,
  inner: Pick<Validator<unknown>, "isAsync" | "isOptional">,
  meta?: ValidatorMeta,
): Validator<T, I, A> => {
  let isAsyncTree: boolean | undefined;
  // Set once a run without async rules returned a promise (an async
  // transform, default or catch): the Standard Schema interface then lets
  // promises through from the start.
  let returnsPromises = false;

  // Built as Validator<T, I, boolean>; A is a type-only marker.
  const validator: Validator<T, I> = {
    "~meta": meta,
    "~standard": {
      version: 1,
      vendor: "xoe",
      // Sync validators answer synchronously, async ones with a promise. A
      // validator without async rules can still be async (an async
      // transform, default or catch), which only the run shows: the sync run
      // then stops with ASYNC_IN_SYNC, and the value is validated again in a
      // mode that waits for promises (so its sync checks run twice, once).
      validate: (value) => {
        isAsyncTree ??= inner.isAsync;
        if (isAsyncTree) {
          return validator.validateAsync(value).then(toStandardResult);
        }
        if (!returnsPromises) {
          try {
            return toStandardResult(
              toOutput<T>(run(value, syncContext()) as RunOutput, value),
            );
          } catch (error) {
            if (!isAsyncInSync(error)) throw error;
            returnsPromises = true;
          }
        }
        const output = run(value, maybeAsyncContext());
        return isPromise<RunOutput>(output)
          ? output.then((settled) =>
              toStandardResult(toOutput<T>(settled, value)),
            )
          : toStandardResult(toOutput<T>(output, value));
      },
    },
    get isAsync() {
      return inner.isAsync;
    },
    get isOptional() {
      return inner.isOptional;
    },
    "~run": run,
    validate: (value, options) => {
      isAsyncTree ??= inner.isAsync;
      if (isAsyncTree) throw asyncError();
      return toOutput<T>(
        run(value, syncContext(options)) as RunOutput,
        value,
        options,
      );
    },
    validateAsync: async (value, options) => {
      throwIfAborted(options?.signal);
      const ctx = asyncContext(options);
      try {
        return toOutput<T>(
          await abortable(run(value, ctx), options?.signal),
          value,
          options,
        );
      } catch (error) {
        // The validation failed (a check rejected, or the caller aborted):
        // the async checks still queued don't start.
        ctx.limit?.close(error);
        throw error;
      }
    },
  };
  return validator as Validator<T, I, A>;
};

/** Issues already have message and path, as Standard Schema expects. */
const toStandardResult = <T>(
  result: XOEValidationOutput<T>,
): StandardSchemaV1.Result<T> =>
  result.type === "success"
    ? { value: result.value }
    : { issues: result.value };

/** Runs `validator` with `patch` applied to the context of its whole subtree. */
export const withContext = <T, I = T, A extends boolean = boolean>(
  validator: Validator<T, I, A>,
  patch: Partial<Omit<RunContext, "path" | "sync">>,
): Validator<T, I, A> =>
  createValidator<T, I, A>(
    (value, ctx) => validator["~run"](value, { ...ctx, ...patch }),
    validator,
    { kind: "context", inner: validator },
  );

/** Whether null is a valid value of `validator` itself (nullable()). */
const acceptsNull = (validator: AnyValidator): boolean => {
  const meta = validator["~meta"];
  switch (meta?.kind) {
    case "state":
      return meta.state.nullable;
    case "pipe":
      return acceptsNull(meta.first);
    case "context":
    case "optional":
      return acceptsNull(meta.inner);
    default:
      return false;
  }
};

/**
 * Runs `next` on the output of `first` (only when `first` is valid). An empty
 * output of an optional `first` skips `next` ("" becomes undefined), and so
 * does null of a nullable `first`, as the output type says. Other outputs,
 * also undefined from a transform, go to `next` (its default applies).
 */
export const pipeValidators = <T, I, A extends boolean = boolean>(
  first: Validator<unknown, I>,
  next: Validator<T, unknown>,
): Validator<T, I, A> =>
  createValidator<T, I, A>(
    (value, ctx) =>
      andThen(first["~run"](value, ctx), (output) => {
        if (output.issues.length > 0) return output;
        if (output.value === null && acceptsNull(first)) return output;
        if (first.isOptional && isEmptyIn(ctx, output.value)) {
          return output.value === ""
            ? { value: undefined, issues: [] }
            : output;
        }
        return next["~run"](output.value, ctx);
      }),
    {
      get isAsync() {
        return first.isAsync || next.isAsync;
      },
      isOptional: first.isOptional,
    },
    { kind: "pipe", first, next },
  );
