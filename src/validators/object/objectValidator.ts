import {
  addRule,
  AnyAsync,
  AnyValidator,
  appendIssues,
  childContext,
  Combinator,
  createState,
  createValidator,
  ExtendedValidator,
  extendValidator,
  Infer,
  InferInput,
  IsAsync,
  isEmptyIn,
  runChildren,
  RunOutput,
  andThen,
  updateState,
  Validator,
  ValidatorState,
} from "../../core/validator/index.ts";
import {
  createIssue,
  createRule,
  issueWithMessage,
  ruleMessage,
} from "../../core/rule.ts";
import {
  createEnumValidator,
  type EnumValidator,
} from "../literal/literalValidator.ts";
import {
  getOwn,
  hasOwn,
  isPlainObject,
  setOwn,
} from "../../core/ownProperties.ts";
import { NoRules, Simplify } from "../../core/types.ts";
import { XOEData, XOEIssue, XOEPath } from "../../core/validatorTypes.ts";
import * as en from "../../core/english.ts";

export type Shape = Record<string, AnyValidator>;

// Keys whose type can be undefined become optional keys. unknown values stay
// required keys: unknown already includes undefined.
type OptionalKeys<V> = {
  [K in keyof V]: undefined extends V[K]
    ? unknown extends V[K]
      ? never
      : K
    : never;
}[keyof V];

type WithOptionalKeys<V> = Simplify<
  { [K in Exclude<keyof V, OptionalKeys<V>>]: V[K] } & {
    [K in OptionalKeys<V>]?: V[K];
  }
>;

/** The output type of an object shape. */
export type ObjectOutput<S extends Shape> = WithOptionalKeys<{
  [K in keyof S]: Infer<S[K]>;
}>;

/** The input type of an object shape (InferInput). */
export type ObjectInput<S extends Shape> = WithOptionalKeys<{
  [K in keyof S]: InferInput<S[K]>;
}>;

type UnknownKeys =
  | { mode: "strip" }
  | { mode: "passthrough" }
  | { mode: "strict"; message?: string }
  | { mode: "catchall"; validator: AnyValidator };

const strictIssue = (
  shape: Shape,
  unknownKeys: Extract<UnknownKeys, { mode: "strict" }>,
  keys: readonly string[],
  path: XOEPath,
  errorMessage: string | undefined,
): XOEIssue => {
  const allowedKeys = Object.keys(shape);
  return issueWithMessage(
    "object.strict",
    [errorMessage, unknownKeys.message],
    en.strict(allowedKeys),
    path,
    // keys: the unknown keys, e.g. to highlight them.
    { allowedKeys, keys },
  );
};

const shapeCombinator = (
  shape: Shape,
  unknownKeys: UnknownKeys,
): Combinator => {
  // The shape is frozen: its entries are the same for every validation.
  const entries = Object.entries(shape);
  return {
    meta: {
      kind: "object",
      shape,
      unknownKeys: unknownKeys.mode,
      ...(unknownKeys.mode === "catchall"
        ? { catchall: unknownKeys.validator }
        : {}),
    },
    get isAsync() {
      return (
        Object.values(shape).some((validator) => validator.isAsync) ||
        (unknownKeys.mode === "catchall" && unknownKeys.validator.isAsync)
      );
    },
    run: (value: XOEData, ctx, { abortEarly, errorMessage }) => {
      const unknown =
        unknownKeys.mode === "strict"
          ? Object.keys(value).filter((key) => !hasOwn(shape, key))
          : [];
      const issues: XOEIssue[] =
        unknown.length > 0
          ? [
              strictIssue(
                shape,
                unknownKeys as Extract<UnknownKeys, { mode: "strict" }>,
                unknown,
                ctx.path,
                errorMessage,
              ),
            ]
          : [];
      if (abortEarly && issues.length > 0) return { value, issues };

      const output: XOEData =
        unknownKeys.mode === "passthrough" ? { ...value } : {};

      // catchall: the keys that are not in the shape, with its validator.
      const fields =
        unknownKeys.mode === "catchall"
          ? [
              ...entries,
              ...Object.keys(value)
                .filter((key) => !hasOwn(shape, key))
                .map((key): [string, AnyValidator] => [
                  key,
                  unknownKeys.validator,
                ]),
            ]
          : entries;

      return andThen(
        runChildren(
          fields,
          ([key, validator]) =>
            validator["~run"](
              getOwn(value, key),
              childContext(ctx, key, value),
            ),
          ([key], field) => {
            if (field.issues.length > 0) appendIssues(issues, field.issues);
            if (hasOwn(value, key) || field.value !== undefined) {
              setOwn(output, key, field.value);
            }
          },
          ctx,
          abortEarly,
        ),
        () => ({ value: output, issues }),
      );
    },
  };
};

const objectTransforms = (shape: Shape) => ({
  /** Keeps keys that are not part of the shape (by default they are removed). */
  passthrough: (state: ValidatorState): ValidatorState =>
    updateState(state, {
      children: shapeCombinator(shape, { mode: "passthrough" }),
    }),
  /** Reports keys that are not part of the shape (code "object.strict"). */
  strict: (state: ValidatorState, message?: string): ValidatorState =>
    updateState(state, {
      children: shapeCombinator(shape, { mode: "strict", message }),
    }),
  requireOne: (state: ValidatorState, message?: string): ValidatorState =>
    addRule(
      state,
      createRule<XOEData>({
        code: "object.requireOne",
        params: { keys: Object.keys(shape) },
        check: (value, _data, { isEmpty }) =>
          Object.keys(shape).some((key) => !isEmpty(getOwn(value, key))),
        ...ruleMessage(message, en.requireOne),
      }),
    ),
});

/** Shape where every field also accepts empty values. */
export type PartialShape<S extends Shape> = {
  [K in keyof S]: Validator<
    Infer<S[K]> | null | undefined,
    InferInput<S[K]> | null | undefined,
    IsAsync<S[K]>
  >;
};

/** Shape where the fields report empty values again (requiredFields). */
export type RequiredShape<S extends Shape> = {
  [K in keyof S]: Validator<
    Exclude<Infer<S[K]>, undefined>,
    Exclude<InferInput<S[K]>, undefined>,
    IsAsync<S[K]>
  >;
};

/**
 * The fields plus an index signature for the other keys (catchall). The index
 * type also includes the field types, as TypeScript requires.
 */
type WithIndex<O, V> = Simplify<O & { [key: string]: V | O[keyof O] }>;

/** An object is async when any of its fields is. */
export type ShapeAsync<S extends Shape> = AnyAsync<S[keyof S]>;

type MergeShapes<S extends Shape, E extends Shape> = Simplify<
  Omit<S, keyof E> & E
>;

type ShapeValidator<S extends Shape> = ObjectValidator<
  ObjectOutput<S>,
  S,
  ObjectInput<S>,
  ShapeAsync<S>
>;

/**
 * Members of object validators. pick, omit, partial and extend return a new
 * object validator with only the new shape: object settings (strict,
 * passthrough, refine, requireOne, optional, default) are not copied.
 */
export interface ObjectMembers<S extends Shape> {
  /** The field validators (frozen). */
  readonly shape: Readonly<S>;
  pick<K extends keyof S & string>(...keys: K[]): ShapeValidator<Pick<S, K>>;
  omit<K extends keyof S & string>(...keys: K[]): ShapeValidator<Omit<S, K>>;
  /** Makes all fields optional, or only the given ones. */
  partial(): ShapeValidator<PartialShape<S>>;
  partial<K extends keyof S & string>(
    ...keys: K[]
  ): ShapeValidator<Simplify<Omit<S, K> & PartialShape<Pick<S, K>>>>;
  /** Makes all fields required again (the opposite of partial), or only the given ones. */
  requiredFields(): ShapeValidator<RequiredShape<S>>;
  requiredFields<K extends keyof S & string>(
    ...keys: K[]
  ): ShapeValidator<Simplify<Omit<S, K> & RequiredShape<Pick<S, K>>>>;
  /** Adds fields; fields with the same name are replaced. */
  extend<E extends Shape>(shape: E): ShapeValidator<MergeShapes<S, E>>;
  /** An enum of the field names, e.g. for a sortBy parameter. */
  keyof(): EnumValidator<keyof S & string>;
  /**
   * Validates the keys that are not in the shape with `validator` and keeps
   * them in the output (instead of removing them).
   */
  catchall<V extends AnyValidator>(
    validator: V,
  ): ObjectValidator<
    WithIndex<ObjectOutput<S>, Infer<V>>,
    S,
    WithIndex<ObjectInput<S>, InferInput<V>>,
    AnyAsync<S[keyof S] | V>
  >;
}

export type ObjectValidator<
  T,
  S extends Shape = Record<never, never>,
  I = T,
  A extends boolean = ShapeAsync<S>,
> = ExtendedValidator<
  T,
  NoRules,
  ReturnType<typeof objectTransforms>,
  ObjectMembers<S>,
  I,
  A
>;

/**
 * The validator with empty values allowed: optional() when it has one, else
 * (transform and pipe results, lazy, localized, jsonSchema) a wrapper. The
 * wrapper runs the validator first for empty values, so defaults still apply,
 * and lets them pass when it rejects them ("" becomes undefined); with
 * `runEmpty` false it skips empty values without running it. Also used by
 * xoe.jsonSchema, whose defaults have their own wrapper.
 */
export const toOptional = (
  validator: AnyValidator,
  runEmpty = true,
): AnyValidator => {
  const withOptional = validator as AnyValidator & {
    optional?: () => AnyValidator;
  };
  if (typeof withOptional.optional === "function") {
    return withOptional.optional();
  }
  return createValidator(
    (value, ctx) => {
      if (!isEmptyIn(ctx, value)) return validator["~run"](value, ctx);
      if (!runEmpty) return { value, issues: [] };
      return andThen(validator["~run"](value, ctx), (output): RunOutput =>
        output.issues.length === 0
          ? output
          : { value: value === "" ? undefined : value, issues: [] },
      );
    },
    {
      isOptional: true,
      get isAsync() {
        return validator.isAsync;
      },
    },
    { kind: "optional", inner: validator },
  );
};

/**
 * The opposite of toOptional for requiredFields(): it restores presence and
 * keeps everything else (nullable, defaults, messages). Fields that are
 * already required are returned as they are.
 */
const toRequired = (validator: AnyValidator): AnyValidator => {
  const meta = validator["~meta"];
  // Undo every partial() layer.
  if (meta?.kind === "optional") return toRequired(meta.inner);
  if (!validator.isOptional) return validator;
  const chain = validator as AnyValidator & {
    required?: () => AnyValidator & { nullable?: () => AnyValidator };
  };
  if (typeof chain.required === "function") {
    // required() also makes null empty; a nullable field stays nullable.
    const required = chain.required();
    return meta?.kind === "state" &&
      meta.state.nullable &&
      typeof required.nullable === "function"
      ? required.nullable()
      : required;
  }
  // Optional validators without required(): run them (defaults apply) and
  // report an empty output, as required() does.
  return createValidator(
    (value, ctx) =>
      andThen(validator["~run"](value, ctx), (output): RunOutput =>
        output.issues.length === 0 && isEmptyIn(ctx, output.value)
          ? {
              value: output.value,
              issues: [createIssue("required", en.required, ctx.path)],
            }
          : output,
      ),
    {
      isOptional: false,
      get isAsync() {
        return validator.isAsync;
      },
    },
    { kind: "context", inner: validator },
  );
};

const copyShape = (shape: Shape, keys: readonly string[]): Shape => {
  const copy: Shape = {};
  for (const key of keys) {
    if (hasOwn(shape, key)) setOwn(copy, key, shape[key]);
  }
  return copy;
};

// Typed by ObjectMembers; the implementation works on plain shapes.
const objectMembers = (shape: Shape): ObjectMembers<Shape> =>
  ({
    shape,
    pick: (...keys: string[]) => createObjectValidator(copyShape(shape, keys)),
    omit: (...keys: string[]) =>
      createObjectValidator(
        copyShape(
          shape,
          Object.keys(shape).filter((key) => !keys.includes(key)),
        ),
      ),
    partial: (...keys: string[]) => {
      const optionalKeys = keys.length > 0 ? keys : Object.keys(shape);
      const next = copyShape(shape, Object.keys(shape));
      for (const key of optionalKeys) {
        if (hasOwn(shape, key)) setOwn(next, key, toOptional(shape[key]));
      }
      return createObjectValidator(next);
    },
    requiredFields: (...keys: string[]) => {
      const requiredKeys = keys.length > 0 ? keys : Object.keys(shape);
      const next = copyShape(shape, Object.keys(shape));
      for (const key of requiredKeys) {
        if (hasOwn(shape, key)) setOwn(next, key, toRequired(shape[key]));
      }
      return createObjectValidator(next);
    },
    keyof: () =>
      createEnumValidator(
        Object.keys(shape) as unknown as [string, ...string[]],
      ),
    catchall: (validator: AnyValidator) =>
      createCatchallObject(shape, validator),
    extend: (extension: Shape) => {
      const next = copyShape(shape, Object.keys(shape));
      for (const [key, validator] of Object.entries(extension)) {
        setOwn(next, key, validator);
      }
      return createObjectValidator(next);
    },
  }) as unknown as ObjectMembers<Shape>;

const createCatchallObject = (
  shape: Shape,
  validator: AnyValidator,
  typeCheck: (value: unknown) => boolean = isPlainObject,
) =>
  extendValidator(
    {},
    {
      ...objectTransforms(shape),
      // Other keys are already kept (and validated by the catchall).
      passthrough: (state: ValidatorState): ValidatorState => state,
    },
    objectMembers(shape),
  )(
    createState("object", typeCheck, {
      children: shapeCombinator(shape, { mode: "catchall", validator }),
    }),
  );

/**
 * @internal For xoe.jsonSchema: an object validator of `shape` with its own
 * type check (plain JSON objects only) and a mode for the other keys, or a
 * validator for them (catchall).
 */
export const createObjectWithTypeCheck = (
  shape: Shape,
  typeCheck: (value: unknown) => boolean,
  unknownKeys: "passthrough" | "strict" | AnyValidator,
): AnyValidator => {
  const fields = Object.freeze(copyShape(shape, Object.keys(shape)));
  if (typeof unknownKeys !== "string") {
    return createCatchallObject(fields, unknownKeys, typeCheck);
  }
  return extendValidator(
    {},
    objectTransforms(fields),
    objectMembers(fields),
  )(
    createState("object", typeCheck, {
      children: shapeCombinator(
        fields,
        unknownKeys === "strict" ? { mode: "strict" } : { mode: "passthrough" },
      ),
    }),
  );
};

export function createObjectValidator(): ObjectValidator<
  Record<string, unknown>
>;
export function createObjectValidator<S extends Shape>(
  shape: S,
): ObjectValidator<ObjectOutput<S>, S, ObjectInput<S>, ShapeAsync<S>>;
export function createObjectValidator(
  shape?: Shape,
  // oxlint-disable-next-line typescript/no-explicit-any
): ObjectValidator<any, any, any, boolean> {
  // A frozen copy: changing the object passed in can't change the validator.
  const fields = Object.freeze(
    shape ? copyShape(shape, Object.keys(shape)) : {},
  );

  return extendValidator(
    {},
    objectTransforms(fields),
    objectMembers(fields),
  )(
    createState("object", isPlainObject, {
      // Without a shape the object is copied (passthrough), never returned
      // as is, so changing the output can't change the input.
      children: shapeCombinator(fields, {
        mode: shape ? "strip" : "passthrough",
      }),
    }),
  );
}
