import { XOEUsageError } from "../errors.ts";
import {
  addRule,
  AnyValidator,
  createBaseValidator,
  Infer,
  InferInput,
  IsAsync,
  OrAsync,
  pipeValidators,
  updateState,
  Validator,
  ValidatorState,
  XOEAnnotations,
} from "./baseValidator.ts";
import {
  AnyRule,
  createRule,
  markRefinement,
  RuleConfig,
  RuleContext,
  ruleMessage,
  RuleRegistry,
  RuleWithConfig,
  XOEIssueInput,
} from "../rule.ts";
import { XOEData, XOEIssue, XOEPath } from "../validatorTypes.ts";
import { deepEqual } from "../deepEqual.ts";
import { constantOf } from "../copy.ts";
import { getOwn } from "../ownProperties.ts";
import * as en from "../english.ts";

/** Type specific methods that change the validator state (e.g. object.requireOne). */
export type StateTransforms = Record<
  string,
  (state: ValidatorState, ...args: never[]) => ValidatorState
>;

type Present<T> = Exclude<T, null | undefined>;

export type RefineOptions = {
  message?: string;
  /** Defaults to "custom". */
  code?: string;
  /** Reports the issue on a nested value, e.g. ["endDate"] on an object. */
  path?: XOEPath;
};
type Nullish<T> = Extract<T, null | undefined>;

/**
 * Accepted by pipe() when it accepts the current output, or when the output
 * is unknown (e.g. after JSON.parse): validators check unknown values at
 * runtime. Otherwise the type error names the problem.
 */
export type PipeTarget<T, V extends AnyValidator> =
  unknown extends Present<T>
    ? V
    : [Present<T>] extends [InferInput<V>]
      ? V
      : V & { "~pipe": "the next validator does not accept this output" };

/** Validator returned by pipe(): only further pipes can follow. */
export type PipedValidator<T, I = T, A extends boolean = false> = Validator<
  T,
  I,
  A
> & {
  /** Validates the output with the next validator. */
  pipe<V extends AnyValidator>(
    next: PipeTarget<T, V>,
  ): PipedValidator<Infer<V> | Nullish<T>, I, OrAsync<A, IsAsync<V>>>;
};

/** true when a transform returns a promise. */
type AsyncResult<U> = [U] extends [PromiseLike<unknown>] ? true : false;

/** Validator returned by transform(): the output type changed, so only further transforms and pipes can follow. */
export type TransformedValidator<
  T,
  I = T,
  A extends boolean = false,
> = PipedValidator<T, I, A> & {
  transform<U>(
    fn: (value: Present<T>) => U,
  ): TransformedValidator<
    Awaited<U> | Nullish<T>,
    I,
    OrAsync<A, AsyncResult<U>>
  >;
};

export interface ChainMethods<
  T,
  R extends RuleRegistry,
  X extends StateTransforms,
  M extends object,
  I,
  A extends boolean,
> extends Validator<T, I, A> {
  optional(): ExtendedValidator<
    T | null | undefined,
    R,
    X,
    M,
    I | null | undefined,
    A
  >;
  /**
   * null is a valid value (it passes and stays null); undefined and "" are
   * still empty, unlike optional().
   */
  nullable(): ExtendedValidator<T | null, R, X, M, I | null, A>;
  /**
   * Returns the fallback instead of failing, e.g. for query params. A
   * function gets the issues and the input. Applies to the whole validator.
   */
  catch(
    fallback: T | ((issues: XOEIssue[], input: unknown) => T),
  ): ExtendedValidator<T, R, X, M, I, A>;
  /**
   * Empty values (undefined, null, "") report "required". This also undoes
   * nullable(): null is empty again.
   */
  required(
    message?: string,
  ): ExtendedValidator<Present<T>, R, X, M, Present<I>, A>;
  /** Replaces the message of every issue reported for this value; codes stay. */
  errorMessage(message: string): ExtendedValidator<T, R, X, M, I, A>;
  /**
   * Documents the value: title, description, examples, deprecated. Merged
   * with earlier meta(); toJsonSchema writes it to the schema (OpenAPI).
   */
  meta(annotations: XOEAnnotations): ExtendedValidator<T, R, X, M, I, A>;
  /** Shorthand for meta({ description }). */
  describe(description: string): ExtendedValidator<T, R, X, M, I, A>;
  abortEarly(): ExtendedValidator<T, R, X, M, I, A>;
  /**
   * A custom rule: refine(check, message?, code?) or refine(check, { message,
   * code, path }). A type guard narrows the output type, e.g.
   * (v): v is "admin" => ...
   */
  refine<U extends Present<T>>(
    check: (
      value: Present<T>,
      data: XOEData | undefined,
      context: RuleContext,
    ) => value is U,
    message?: string,
    code?: string,
  ): ExtendedValidator<U | Nullish<T>, R, X, M, I, A>;
  refine<U extends Present<T>>(
    check: (
      value: Present<T>,
      data: XOEData | undefined,
      context: RuleContext,
    ) => value is U,
    options?: string | RefineOptions,
  ): ExtendedValidator<U | Nullish<T>, R, X, M, I, A>;
  refine(
    check: (
      value: Present<T>,
      data: XOEData | undefined,
      context: RuleContext,
    ) => boolean,
    message?: string,
    code?: string,
  ): ExtendedValidator<T, R, X, M, I, A>;
  refine(
    check: (
      value: Present<T>,
      data: XOEData | undefined,
      context: RuleContext,
    ) => boolean,
    options?: string | RefineOptions,
  ): ExtendedValidator<T, R, X, M, I, A>;
  /**
   * The context has the abort signal of validateAsync(value, { signal }).
   * Makes the validator async: validate() becomes a type error.
   */
  refineAsync(
    check: (
      value: Present<T>,
      data: XOEData | undefined,
      context: RuleContext,
    ) => Promise<boolean>,
    message?: string,
    code?: string,
  ): ExtendedValidator<T, R, X, M, I, true>;
  refineAsync(
    check: (
      value: Present<T>,
      data: XOEData | undefined,
      context: RuleContext,
    ) => Promise<boolean>,
    options?: string | RefineOptions,
  ): ExtendedValidator<T, R, X, M, I, true>;
  /**
   * Returns any number of issues (none means valid), each with a message and
   * optionally a code (default "custom"), a relative path and params.
   */
  superRefine(
    check: (
      value: Present<T>,
      data: XOEData | undefined,
      context: RuleContext,
    ) => readonly XOEIssueInput[] | void,
  ): ExtendedValidator<T, R, X, M, I, A>;
  /** Async superRefine; runs like refineAsync and makes the validator async. */
  superRefineAsync(
    check: (
      value: Present<T>,
      data: XOEData | undefined,
      context: RuleContext,
    ) => Promise<readonly XOEIssueInput[] | void>,
  ): ExtendedValidator<T, R, X, M, I, true>;
  sameAs(field: string, message?: string): ExtendedValidator<T, R, X, M, I, A>;
  /**
   * Used when the value is empty (undefined, null or "") or null; a function
   * is called on every use. A validator with a default never returns null.
   */
  default(
    value: Present<T> | (() => Present<T>),
  ): ExtendedValidator<Present<T>, R, X, M, I | null | undefined, A>;
  /**
   * Maps the valid value to the output; runs after all rules. An async
   * function makes the validator async (validateAsync()).
   */
  transform<U>(
    fn: (value: Present<T>) => U,
  ): TransformedValidator<
    Awaited<U> | Nullish<T>,
    I,
    OrAsync<A, AsyncResult<U>>
  >;
  /**
   * Validates the output with the next validator, e.g.
   * xoe.string().transform(JSON.parse).pipe(xoe.object({...})). It must accept
   * this validator's output. Optional empty values skip it.
   */
  pipe<V extends AnyValidator>(
    next: PipeTarget<T, V>,
  ): PipedValidator<Infer<V> | Nullish<T>, I, OrAsync<A, IsAsync<V>>>;
  /**
   * Adds rules created by createRule or the rule registries (stringRules,
   * ...). Async rules added this way keep the type sync; validate() still
   * throws ASYNC_IN_SYNC for them at runtime.
   */
  with(
    ...rules: readonly RuleWithConfig<Present<T>>[]
  ): ExtendedValidator<T, R, X, M, I, A>;
}

/**
 * A validator with the common chain methods, the rules of R, the
 * state-changing methods of X and the members M (e.g. object.shape), all
 * kept through the chain. A marks async validators (see Validator).
 */
export type ExtendedValidator<
  T,
  R extends RuleRegistry,
  X extends StateTransforms = Record<never, never>,
  M extends object = Record<never, never>,
  I = T,
  A extends boolean = false,
> = ChainMethods<T, R, X, M, I, A> & {
  [K in keyof R]: (
    ...args: Parameters<R[K]>
  ) => ExtendedValidator<T, R, X, M, I, A>;
} & {
  [K in keyof X]: X[K] extends (
    state: ValidatorState,
    ...args: infer Args
  ) => ValidatorState
    ? (...args: Args) => ExtendedValidator<T, R, X, M, I, A>
    : never;
} & M;

const refineConfig = (options: string | RefineOptions = {}, code?: string) => {
  const {
    message,
    code: optionCode,
    path,
  } = typeof options === "string"
    ? { message: options, code, path: undefined }
    : options;
  return {
    code: optionCode ?? code ?? "custom",
    // The rule's own message: catalogs may translate it by its code.
    message: message ?? en.custom,
    path,
  };
};

const assertFreeName = (validator: Record<string, unknown>, name: string) => {
  if (name in validator) {
    throw new XOEUsageError(
      "NAME_CONFLICT",
      `xoe: rule "${name}" conflicts with a built-in validator method.`,
    );
  }
};

// Object.assign below keeps the base validator's isAsync getter (a spread
// would evaluate it).

const createPipedValidator = <T, I>(
  validator: Validator<T, I>,
): PipedValidator<T, I> =>
  Object.assign(validator, {
    pipe: (next: AnyValidator) =>
      createPipedValidator(pipeValidators(validator, next)),
  }) as PipedValidator<T, I>;

const createTransformedValidator = <T, I>(
  state: ValidatorState,
): TransformedValidator<T, I> =>
  Object.assign(createPipedValidator(createBaseValidator<T, I>(state)), {
    transform: <U>(fn: (value: T) => U) =>
      createTransformedValidator<U, I>(
        updateState(state, { transforms: [...state.transforms, fn] }),
      ),
  }) as TransformedValidator<T, I>;

/**
 * Returns a pure `state -> validator` function. Every chained call builds a new
 * state and a new validator, existing validators are never modified.
 */
export const extendValidator = <
  T,
  R extends RuleRegistry,
  X extends StateTransforms = Record<never, never>,
  M extends object = Record<never, never>,
  I = T,
  A extends boolean = false,
>(
  rules: R,
  transforms: X = {} as X,
  /** Members added to every validator of the chain, e.g. object.shape. */
  members: M = {} as M,
) => {
  const build = (
    state: ValidatorState,
  ): ExtendedValidator<T, R, X, M, I, A> => {
    const next = (nextState: ValidatorState) => build(nextState) as never;
    const withRule = (rule: AnyRule) => next(addRule(state, rule));

    // Object.assign keeps the base validator's isAsync getter (a spread would evaluate it).
    const validator: Record<string, unknown> = Object.assign(
      createBaseValidator<T, I>(state) as unknown as Record<string, unknown>,
      {
        optional: () => next(updateState(state, { presence: "optional" })),
        nullable: () => next(updateState(state, { nullable: true })),
        catch: (fallback: unknown) =>
          next(
            updateState(state, {
              fallback:
                typeof fallback === "function"
                  ? (fallback as (
                      issues: XOEIssue[],
                      input: unknown,
                    ) => unknown)
                  : constantOf(fallback),
            }),
          ),
        required: (message?: string) =>
          next(
            updateState(state, {
              presence: "required",
              nullable: false,
              ...(message === undefined
                ? {}
                : {
                    requiredMessage: message,
                    customRequiredMessage: true,
                  }),
            }),
          ),
        errorMessage: (message: string) =>
          next(updateState(state, { errorMessage: message })),
        meta: (annotations: XOEAnnotations) =>
          next(
            updateState(state, {
              annotations: { ...state.annotations, ...annotations },
            }),
          ),
        describe: (description: string) =>
          next(
            updateState(state, {
              annotations: { ...state.annotations, description },
            }),
          ),
        abortEarly: () => next(updateState(state, { abortEarly: true })),
        refine: (
          check: RuleConfig<unknown>["check"],
          options?: string | RefineOptions,
          code?: string,
        ) =>
          withRule(
            markRefinement(
              createRule({ ...refineConfig(options, code), check }),
            ),
          ),
        refineAsync: (
          check: RuleConfig<unknown>["check"],
          options?: string | RefineOptions,
          code?: string,
        ) =>
          withRule(
            markRefinement(
              createRule({
                ...refineConfig(options, code),
                check,
                async: true,
              }),
            ),
          ),
        superRefine: (check: RuleConfig<unknown>["check"]) =>
          withRule(markRefinement(createRule({ ...refineConfig(), check }))),
        superRefineAsync: (check: RuleConfig<unknown>["check"]) =>
          withRule(
            markRefinement(
              createRule({ ...refineConfig(), check, async: true }),
            ),
          ),
        sameAs: (field: string, message?: string) =>
          withRule(
            createRule({
              code: "sameAs",
              ...ruleMessage(message, en.sameAs(field)),
              params: { field },
              check: (value, data) =>
                deepEqual(value, data ? getOwn(data, field) : undefined),
            }),
          ),
        default: (value: unknown) =>
          next(
            updateState(state, {
              defaultValue:
                typeof value === "function"
                  ? (value as () => unknown)
                  : constantOf(value),
            }),
          ),
        transform: (fn: (value: unknown) => unknown) =>
          createTransformedValidator(
            updateState(state, { transforms: [...state.transforms, fn] }),
          ),
        pipe: (nextValidator: AnyValidator) =>
          createPipedValidator(
            pipeValidators(createBaseValidator<T, I>(state), nextValidator),
          ),
        with: (...rules: AnyRule[]) => next(rules.reduce(addRule, state)),
      },
    );

    for (const [name, factory] of Object.entries(rules)) {
      assertFreeName(validator, name);
      validator[name] = (...args: never[]) => withRule(factory(...args));
    }
    for (const [name, transform] of Object.entries(transforms)) {
      assertFreeName(validator, name);
      validator[name] = (...args: never[]) => next(transform(state, ...args));
    }
    for (const [name, member] of Object.entries(members)) {
      assertFreeName(validator, name);
      validator[name] = member;
    }

    return validator as ExtendedValidator<T, R, X, M, I, A>;
  };

  return build;
};
