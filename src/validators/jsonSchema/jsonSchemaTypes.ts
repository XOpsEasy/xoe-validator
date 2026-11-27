import type { JsonSchema } from "./jsonSchemaValidator.ts";
import type { Simplify } from "../../core/types.ts";

/**
 * The type of the values a JSON Schema accepts, for schemas written as
 * literals (`as const`, or inline in `xoe.jsonSchema`). Follows the runtime:
 * properties are optional unless listed in `required`, additional properties
 * are kept unless `additionalProperties` is false, and keywords that only
 * check values (minLength, pattern, format, ...) don't change the type.
 *
 * Gives `unknown` where the schema isn't known at compile time (a `JsonSchema`
 * variable, a JSON import) and for recursive `$ref`s.
 *
 * @typeParam Root - the document `$ref`s point into (the `root` option).
 * @typeParam Defaults - true with `useDefaults: true`: properties with a
 *   default are always present.
 */
export type FromJsonSchema<
  S,
  Root = S,
  Defaults extends boolean = false,
> = SchemaType<
  S,
  { root: Root; defaults: Defaults; output: true; seen: never }
>;

/** The input type: properties with a default may be missing. */
export type FromJsonSchemaInput<
  S,
  Root = S,
  Defaults extends boolean = false,
> = SchemaType<
  S,
  { root: Root; defaults: Defaults; output: false; seen: never }
>;

type Ctx = {
  root: unknown;
  defaults: boolean;
  /** Output (defaults filled in) or input type. */
  output: boolean;
  /** $refs being expanded, to stop at recursion. */
  seen: string;
};

type SchemaType<S, C extends Ctx> = [S] extends [boolean]
  ? boolean extends S
    ? unknown
    : S extends true
      ? unknown
      : never
  : // A schema typed as JsonSchema (or wider) isn't known at compile time.
    JsonSchema extends S
    ? unknown
    : S extends object
      ? Nullable<S, Parts<S, C>>
      : unknown;

/** Distributes over a union of schemas (anyOf, oneOf). */
type EachType<S, C extends Ctx> = S extends unknown ? SchemaType<S, C> : never;

type Nullable<S, T> = S extends { nullable: true } ? T | null : T;

// Every keyword must pass, so the type is the intersection of their types;
// a missing keyword adds `unknown`, which changes nothing.
type Parts<S, C extends Ctx> = RefPart<S, C> &
  TypePart<S, C> &
  EnumPart<S> &
  ConstPart<S> &
  AnyOfPart<S, C> &
  OneOfPart<S, C> &
  AllOfPart<S, C>;

type EnumPart<S> = S extends { enum: infer E extends readonly unknown[] }
  ? E[number]
  : unknown;

type ConstPart<S> = S extends { const: infer V } ? V : unknown;

type AnyOfPart<S, C extends Ctx> = S extends {
  anyOf: infer L extends readonly unknown[];
}
  ? EachType<L[number], C>
  : unknown;

type OneOfPart<S, C extends Ctx> = S extends {
  oneOf: infer L extends readonly unknown[];
}
  ? EachType<L[number], C>
  : unknown;

type AllOfPart<S, C extends Ctx> = S extends {
  allOf: infer L extends readonly unknown[];
}
  ? Intersect<L, C>
  : unknown;

type Intersect<L, C extends Ctx> = L extends readonly [infer H, ...infer R]
  ? SchemaType<H, C> & Intersect<R, C>
  : unknown;

// $ref

type RefPart<S, C extends Ctx> = S extends { $ref: infer R extends string }
  ? string extends R
    ? unknown
    : R extends C["seen"]
      ? unknown
      : SchemaType<
          Resolve<C["root"], R>,
          {
            root: C["root"];
            defaults: C["defaults"];
            output: C["output"];
            seen: C["seen"] | R;
          }
        >
  : unknown;

/** Follows a local JSON pointer; an unknown target accepts any value. */
type Resolve<Root, R extends string> = R extends `#${infer Path}`
  ? Walk<Root, Path>
  : true;

type Walk<N, P extends string> = P extends ""
  ? N
  : P extends `/${infer Rest}`
    ? Rest extends `${infer H}/${infer T}`
      ? H extends keyof N
        ? Walk<N[H], `/${T}`>
        : true
      : Rest extends keyof N
        ? N[Rest]
        : true
    : true;

// type

type TypePart<S, C extends Ctx> = S extends { type: infer T }
  ? T extends readonly unknown[]
    ? string extends T[number]
      ? unknown
      : TypeOf<T[number], S, C>
    : string extends T
      ? unknown
      : TypeOf<T, S, C>
  : unknown;

type TypeOf<T, S, C extends Ctx> = T extends "string"
  ? string
  : T extends "number" | "integer"
    ? number
    : T extends "boolean"
      ? boolean
      : T extends "null"
        ? null
        : T extends "array"
          ? ArrayType<S, C>
          : T extends "object"
            ? ObjectType<S, C>
            : never;

// array

type ArrayType<S, C extends Ctx> = S extends {
  prefixItems: infer P extends readonly unknown[];
}
  ? [...RequiredItems<P, MinItems<S>, C, []>, ...RestItems<S, C>]
  : S extends { items: infer I }
    ? SchemaType<I, C>[]
    : unknown[];

type MinItems<S> = S extends { minItems: infer M extends number }
  ? number extends M
    ? 0
    : M
  : 0;

/** prefixItems up to minItems are required; the ones after are optional. */
type RequiredItems<
  P,
  Min extends number,
  C extends Ctx,
  Out extends unknown[],
> = Out["length"] extends Min
  ? OptionalItems<P, C, Out>
  : P extends readonly [infer H, ...infer R]
    ? RequiredItems<R, Min, C, [...Out, SchemaType<H, C>]>
    : Out;

type OptionalItems<
  P,
  C extends Ctx,
  Out extends unknown[],
> = P extends readonly [infer H, ...infer R]
  ? OptionalItems<R, C, [...Out, SchemaType<H, C>?]>
  : Out;

type RestItems<S, C extends Ctx> = S extends { items: false }
  ? []
  : S extends { items: infer I }
    ? SchemaType<I, C>[]
    : unknown[];

// object

type Properties<S> = S extends { properties: infer P extends object }
  ? P
  : Record<never, never>;

type RequiredKeys<S> = S extends { required: infer R extends readonly string[] }
  ? R[number]
  : never;

type HasDefault<P> = P extends { default: unknown } ? true : false;

/** Whether a property is always there in the input or the output. */
type Present<P, K, S, C extends Ctx> = C["defaults"] extends true
  ? HasDefault<P> extends true
    ? // Filled in when missing: present in the output, optional in the input.
      C["output"]
    : K extends RequiredKeys<S>
      ? true
      : false
  : K extends RequiredKeys<S>
    ? true
    : false;

type ObjectType<S, C extends Ctx, P = Properties<S>> = Simplify<
  {
    -readonly [
      K in keyof P as Present<P[K], K, S, C> extends true ? K : never
    ]: SchemaType<P[K], C>;
  } & {
    -readonly [
      K in keyof P as Present<P[K], K, S, C> extends true ? never : K
    ]?: SchemaType<P[K], C>;
  } &
    // Required keys without a property schema may hold any value.
    { [K in Exclude<RequiredKeys<S>, keyof P>]: unknown } &
    // Additional properties are kept.
    (S extends { additionalProperties: false }
      ? Record<never, never>
      : { [key: string]: unknown })
>;
