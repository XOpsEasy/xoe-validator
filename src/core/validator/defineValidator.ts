import { createState } from "./baseValidator.ts";
import {
  ExtendedValidator,
  extendValidator,
  StateTransforms,
} from "./extendValidator.ts";
import { RuleRegistry } from "../rule.ts";
import * as en from "../english.ts";

export type ValidatorOptions = {
  /** Convert the input to the validator type before validating it. */
  coerce?: boolean;
};

export type ValidatorDefinition<
  T,
  R extends RuleRegistry,
  X extends StateTransforms,
  C = T,
> = {
  /** Name used in the type issue params ({ expected: type }). */
  type: string;
  check: (value: unknown) => value is T;
  /** Message of the type issue. */
  message?: string;
  rules?: R;
  /** Type specific methods that change the state, e.g. string.trim. */
  transforms?: X;
  /** Always applied to the raw input first, e.g. to normalize it. */
  preprocess?: (value: unknown) => unknown;
  /**
   * Used by `{ coerce: true }` to convert raw input before validating it. Its
   * parameter type is the input type of coercing validators (InferInput).
   */
  coerce?: (value: C) => unknown;
};

export type ValidatorFactory<
  T,
  R extends RuleRegistry,
  X extends StateTransforms,
  C = T,
> = {
  (options?: { coerce?: false }): ExtendedValidator<T, R, X>;
  (options: {
    coerce: true;
  }): ExtendedValidator<T, R, X, Record<never, never>, C>;
  (
    options?: ValidatorOptions,
  ): ExtendedValidator<T, R, X, Record<never, never>, T | C>;
  /** Returns a new factory with additional (or replaced) rules; this one is not changed. */
  extend<E extends RuleRegistry>(
    rules: E,
  ): ValidatorFactory<T, Omit<R, keyof E> & E, X, C>;
};

export const defineValidator = <
  T,
  R extends RuleRegistry = Record<never, never>,
  X extends StateTransforms = Record<never, never>,
  C = T,
>(
  definition: ValidatorDefinition<T, R, X, C>,
): ValidatorFactory<T, R, X, C> => {
  const build = extendValidator<T, R, X>(
    definition.rules ?? ({} as R),
    definition.transforms ?? ({} as X),
  );
  // At runtime coerce gets any input and returns values it can't convert.
  const coerce = definition.coerce as ((value: unknown) => unknown) | undefined;
  const typeMessage = definition.message ?? en.type(definition.type);

  const factory = ({ coerce: useCoerce = false }: ValidatorOptions = {}) =>
    build(
      createState(definition.type, definition.check, {
        typeMessage,
        preprocess: [
          ...(definition.preprocess ? [definition.preprocess] : []),
          ...(useCoerce && coerce ? [coerce] : []),
        ],
      }),
    );

  // Builds one validator up front, so rule names that clash with built-in
  // methods fail here and not on first use.
  factory();

  return Object.assign(factory, {
    extend: <E extends RuleRegistry>(rules: E) =>
      defineValidator<T, Omit<R, keyof E> & E, X, C>({
        ...definition,
        rules: { ...definition.rules, ...rules } as Omit<R, keyof E> & E,
      }),
  }) as ValidatorFactory<T, R, X, C>;
};
