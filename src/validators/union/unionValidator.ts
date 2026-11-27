import {
  AnyAsync,
  AnyValidator,
  Combinator,
  createState,
  ExtendedValidator,
  extendValidator,
  Infer,
  InferInput,
  isEmptyIn,
  requiredIssue,
  RunOutput,
  runSequence,
  andThen,
  Validator,
} from "../../core/validator/index.ts";
import { issueWithMessage } from "../../core/rule.ts";
import {
  getOwn,
  hasOwn,
  isPlainObject,
  isPlainRecord,
  setOwn,
} from "../../core/ownProperties.ts";
import { XOEData } from "../../core/validatorTypes.ts";
import { NoRules, Simplify } from "../../core/types.ts";
import * as en from "../../core/english.ts";

export type UnionValidator<
  T,
  I = T,
  A extends boolean = false,
> = ExtendedValidator<
  T,
  NoRules,
  Record<never, never>,
  Record<never, never>,
  I,
  A
>;

const unionCombinator = (
  options: readonly Validator<unknown>[],
  message: string | undefined,
): Combinator => ({
  meta: { kind: "union", options },
  get isAsync() {
    return options.some((option) => option.isAsync);
  },
  run: (value, ctx, state) => {
    let matched: RunOutput | undefined;
    return andThen(
      runSequence(options, (option) =>
        andThen(option["~run"](value, ctx), (output) => {
          if (output.issues.length > 0) return false;
          matched = output;
          return true;
        }),
      ),
      () =>
        matched ?? {
          value,
          issues: [
            issueWithMessage(
              "union",
              [state.errorMessage, message],
              en.union,
              ctx.path,
            ),
          ],
        },
    );
  },
});

/** Accepts a value that matches one of the validators; the first match wins. */
export const createUnionValidator = <
  const V extends readonly [AnyValidator, ...AnyValidator[]],
>(
  options: V,
  message?: string,
): UnionValidator<
  Infer<V[number]>,
  InferInput<V[number]>,
  AnyAsync<V[number]>
> =>
  extendValidator<
    Infer<V[number]>,
    NoRules,
    Record<never, never>,
    Record<never, never>,
    InferInput<V[number]>,
    AnyAsync<V[number]>
  >({})(
    createState("union", () => true, {
      // A frozen copy: changing the list passed in can't change the union.
      children: unionCombinator(Object.freeze([...options]), message),
    }),
  );

/**
 * The discriminator values an option accepts: its key, and for numeric keys
 * also the string form ("1" matches option 1 like the number 1 does).
 */
type DiscriminatorValue<D> = D extends number ? D | `${D}` : D;

type OptionKey<M> = keyof M & (string | number);

export type DiscriminatedOutput<
  K extends string,
  M extends Record<string, AnyValidator>,
> = {
  [D in OptionKey<M>]: Simplify<
    { [P in K]: DiscriminatorValue<D> } & Infer<M[D]>
  >;
}[OptionKey<M>];

export type DiscriminatedInput<
  K extends string,
  M extends Record<string, AnyValidator>,
> = {
  [D in OptionKey<M>]: Simplify<
    { [P in K]: DiscriminatorValue<D> } & InferInput<M[D]>
  >;
}[OptionKey<M>];

/**
 * Whether an option would reject or validate the discriminator as an unknown
 * key: a strict() or catchall() object whose shape doesn't declare it.
 */
const rejectsKey = (option: Validator<unknown>, key: string): boolean => {
  const meta = option["~meta"];
  const children =
    meta?.kind === "state" ? meta.state.children?.meta : undefined;
  return (
    children?.kind === "object" &&
    (children.unknownKeys === "strict" ||
      children.unknownKeys === "catchall") &&
    !hasOwn(children.shape, key)
  );
};

/** The value without `key`, for options whose shape doesn't declare it. */
const without = (value: XOEData, key: string): XOEData => {
  const rest: XOEData = {};
  for (const name of Object.keys(value)) {
    if (name !== key) setOwn(rest, name, value[name]);
  }
  return rest;
};

const discriminatedCombinator = (
  key: string,
  options: Readonly<Record<string, Validator<unknown>>>,
  message?: string,
): Combinator => ({
  meta: { kind: "discriminated", key, options },
  get isAsync() {
    return Object.values(options).some((option) => option.isAsync);
  },
  run: (value: XOEData, ctx, state) => {
    const discriminator = getOwn(value, key);
    const path = [...ctx.path, key];

    if (isEmptyIn(ctx, discriminator)) {
      return {
        value,
        issues: [requiredIssue(state, path)],
      };
    }
    // Object keys are strings, so a numeric discriminator matches key "1".
    const optionKey =
      typeof discriminator === "number" ? String(discriminator) : discriminator;
    if (typeof optionKey !== "string" || !hasOwn(options, optionKey)) {
      const allowed = Object.keys(options);
      return {
        value,
        issues: [
          issueWithMessage(
            "discriminator",
            [state.errorMessage, message],
            en.discriminator(key, allowed),
            path,
            { key, options: allowed },
          ),
        ],
      };
    }

    const option = getOwn(options, optionKey) as Validator<unknown>;
    // A strict() or catchall() option that doesn't declare the key gets the
    // object without it (the key is added back below). Other options get the
    // whole object, so their checks still see the key (data, refine).
    const input = rejectsKey(option, key) ? without(value, key) : value;
    return andThen(option["~run"](input, ctx), (output) =>
      // Only plain objects get the key: a class instance or a Map that an
      // option transforms to is returned as it is.
      output.issues.length > 0 || !isPlainRecord(output.value)
        ? output
        : {
            value: { [key]: discriminator, ...output.value },
            issues: [],
          },
    );
  },
});

/**
 * Picks the object validator by the value of `key`, e.g.
 * discriminatedUnion("type", { card: xoe.object({...}), paypal: xoe.object({...}) }).
 * The discriminator is kept in the output even if the shapes don't declare
 * it; options that don't declare it validate the object without it.
 */
export const createDiscriminatedUnionValidator = <
  const K extends string,
  M extends Record<string, AnyValidator>,
>(
  key: K,
  options: M,
  message?: string,
): UnionValidator<
  DiscriminatedOutput<K, M>,
  DiscriminatedInput<K, M>,
  AnyAsync<M[keyof M]>
> =>
  extendValidator<
    DiscriminatedOutput<K, M>,
    NoRules,
    Record<never, never>,
    Record<never, never>,
    DiscriminatedInput<K, M>,
    AnyAsync<M[keyof M]>
  >({})(
    createState("object", isPlainObject, {
      children: discriminatedCombinator(key, copyOptions(options), message),
    }),
  );

/** A frozen copy: changing the object passed in can't change the union. */
const copyOptions = (
  options: Record<string, AnyValidator>,
): Readonly<Record<string, AnyValidator>> => {
  const copy: Record<string, AnyValidator> = {};
  for (const name of Object.keys(options)) setOwn(copy, name, options[name]);
  return Object.freeze(copy);
};
