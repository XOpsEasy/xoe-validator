import {
  createState,
  ExtendedValidator,
  extendValidator,
} from "../../core/validator/index.ts";
import { NoRules } from "../../core/types.ts";
import * as en from "../../core/english.ts";

export type Literal = string | number | boolean;

export type LiteralValidator<T> = ExtendedValidator<T, NoRules>;

/** Accepts exactly one value (code "literal" otherwise). */
export const createLiteralValidator = <const V extends Literal>(
  expected: V,
  message?: string,
): LiteralValidator<V> =>
  extendValidator<V, NoRules>({})(
    createState("literal", (value) => value === expected, {
      typeMessage: message ?? en.literal(expected),
      customTypeMessage: message !== undefined,
      typeCode: "literal",
      typeParams: { expected },
    }),
  );

/** Members of enum validators. */
export interface EnumMembers<T extends Literal> {
  /** The allowed values, e.g. for a <select>. */
  readonly options: readonly T[];
  /** An enum without the given values. */
  exclude<E extends T>(
    values: readonly E[],
    message?: string,
  ): EnumValidator<Exclude<T, E>>;
  /** An enum with only the given values. */
  extract<E extends T>(
    values: readonly E[],
    message?: string,
  ): EnumValidator<E>;
}

export type EnumValidator<T extends Literal> = ExtendedValidator<
  T,
  NoRules,
  Record<never, never>,
  EnumMembers<T>
>;

/** Accepts one of the given values (code "enum" otherwise). */
export const createEnumValidator = <
  const V extends readonly [Literal, ...Literal[]],
>(
  options: V,
  message?: string,
): EnumValidator<V[number]> => {
  // A frozen copy: changing the array passed in can't change the validator.
  const values = Object.freeze([...options]) as readonly Literal[];
  const subset = (keep: readonly Literal[], subsetMessage?: string) =>
    createEnumValidator(keep as unknown as V, subsetMessage);
  // Typed by EnumMembers; the implementation works on plain values.
  const members = {
    options: values,
    exclude: (excluded: readonly Literal[], subsetMessage?: string) =>
      subset(
        values.filter((value) => !excluded.includes(value)),
        subsetMessage,
      ),
    extract: (kept: readonly Literal[], subsetMessage?: string) =>
      subset(
        values.filter((value) => kept.includes(value)),
        subsetMessage,
      ),
  } as unknown as EnumMembers<V[number]>;
  return extendValidator<
    V[number],
    NoRules,
    Record<never, never>,
    EnumMembers<V[number]>
  >(
    {},
    {},
    members,
  )(
    createState("enum", (value) => values.includes(value as Literal), {
      typeMessage: message ?? en.enumOf(values),
      customTypeMessage: message !== undefined,
      typeCode: "enum",
      typeParams: { options: values },
    }),
  );
};
