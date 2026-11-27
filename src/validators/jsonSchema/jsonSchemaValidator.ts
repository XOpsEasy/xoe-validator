import {
  AnyValidator,
  appendIssues,
  childContext,
  Combinator,
  createState,
  createValidator,
  defineValidator,
  extendValidator,
  isEmptyIn,
  runChildren,
  RunOutput,
  andThen,
  Validator,
  withContext,
} from "../../core/validator/index.ts";
import { createIssue, createRule } from "../../core/rule.ts";
import {
  getOwn,
  hasOwn,
  isPlainObject,
  isPlainRecord,
  setOwn,
} from "../../core/ownProperties.ts";
import { deepEqual } from "../../core/deepEqual.ts";
import { constantOf } from "../../core/copy.ts";
import { XOEUsageError } from "../../core/errors.ts";
import {
  type ArrayValidator,
  createArrayValidator,
} from "../array/arrayValidator.ts";
import { ruleRegistry as arrayRules } from "../array/arrayRules.ts";
import { createBooleanValidator } from "../boolean/booleanValidator.ts";
import { createLazyValidator } from "../lazy/lazyValidator.ts";
import { createNumberValidator } from "../number/numberValidator.ts";
import {
  createObjectWithTypeCheck,
  Shape,
  toOptional,
} from "../object/objectValidator.ts";
import { createStringValidator } from "../string/stringValidator.ts";
import { date, dateTime, email, ip, parseUrl } from "../string/stringRules.ts";
import { greaterThan, lessThan } from "../number/numberRules.ts";
import { createUnionValidator } from "../union/unionValidator.ts";
import { createUnknownValidator } from "../unknown/unknownValidator.ts";
import type { FromJsonSchema, FromJsonSchemaInput } from "./jsonSchemaTypes.ts";
import * as en from "../../core/english.ts";

export type JsonSchemaType =
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "null"
  | "array"
  | "object";

/** A schema object, or true (any value) / false (no value). */
export type JsonSchemaDefinition = JsonSchema | boolean;

/**
 * The supported subset of JSON Schema (draft 2020-12, also OpenAPI 3.1, plus
 * OpenAPI 3.0 nullable and boolean exclusiveMinimum/exclusiveMaximum).
 * Other keywords (title, description, ...) are ignored.
 */
export type JsonSchema = {
  /** One type, or several (a union), e.g. ["string", "null"]. */
  type?: JsonSchemaType | readonly JsonSchemaType[];
  enum?: readonly unknown[];
  const?: unknown;
  /** Local references: "#/$defs/User", "#/components/schemas/User", ... */
  $ref?: string;
  $defs?: Readonly<Record<string, JsonSchemaDefinition>>;
  definitions?: Readonly<Record<string, JsonSchemaDefinition>>;
  anyOf?: readonly JsonSchemaDefinition[];
  oneOf?: readonly JsonSchemaDefinition[];
  allOf?: readonly JsonSchemaDefinition[];
  /** OpenAPI 3.0: null is allowed too. */
  nullable?: boolean;
  /** Used for missing values with { useDefaults: true }. */
  default?: unknown;
  // string
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  /** email, uri, uuid, date, date-time, ipv4 and ipv6 are checked; others are ignored. */
  format?: string;
  // number
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number | boolean;
  exclusiveMaximum?: number | boolean;
  multipleOf?: number;
  // array
  items?: JsonSchemaDefinition;
  prefixItems?: readonly JsonSchemaDefinition[];
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  // object
  properties?: Readonly<Record<string, JsonSchemaDefinition>>;
  required?: readonly string[];
  /** false reports other keys (code "object.strict"); a schema validates them. */
  additionalProperties?: JsonSchemaDefinition;
  [keyword: string]: unknown;
};

export type JsonSchemaOptions = {
  /**
   * The document $ref pointers refer to, e.g. the whole OpenAPI document for
   * "#/components/schemas/User". Defaults to the schema itself.
   */
  root?: unknown;
  /** Use "default" for missing values (JSON Schema treats it as a note). */
  useDefaults?: boolean;
};

type Context = {
  root: unknown;
  useDefaults: boolean;
  refs: Map<string, AnyValidator>;
};

const SCHEMA_TYPES: readonly string[] = [
  "string",
  "number",
  "integer",
  "boolean",
  "null",
  "array",
  "object",
];

const invalidSchema = (message: string) =>
  new XOEUsageError("INVALID_SCHEMA", `xoe.jsonSchema: ${message}`);

const createNullValidator = /* @__PURE__ */ defineValidator({
  type: "null",
  check: (value): value is null => value === null,
});

// ---------- small combinators -------------------------------------------

/**
 * A missing value reports one "required" issue, so the keywords of a schema
 * (type, enum, oneOf, ...) don't each report it.
 */
const presenceOf = (validator: AnyValidator): AnyValidator =>
  createValidator(
    (value, ctx) =>
      isEmptyIn(ctx, value)
        ? { value, issues: [createIssue("required", en.required, ctx.path)] }
        : validator["~run"](value, ctx),
    {
      isOptional: false,
      get isAsync() {
        return validator.isAsync;
      },
    },
    { kind: "context", inner: validator },
  );

/**
 * Applies `validator` only to values that pass `check`: keywords of a schema
 * without type (minLength, required, ...) apply to values of their type.
 */
const whenType = (
  check: (value: unknown) => boolean,
  validator: AnyValidator,
): AnyValidator =>
  createValidator(
    (value, ctx) =>
      check(value) ? validator["~run"](value, ctx) : { value, issues: [] },
    {
      isOptional: false,
      get isAsync() {
        return validator.isAsync;
      },
    },
    { kind: "context", inner: validator },
  );

const nullableOf = (validator: AnyValidator): AnyValidator => {
  const chain = validator as AnyValidator & { nullable?: () => AnyValidator };
  return typeof chain.nullable === "function"
    ? chain.nullable()
    : createUnionValidator([validator, createNullValidator()]);
};

/**
 * The outputs of allOf parts as one, so the defaults of every part are filled
 * in (useDefaults), also in nested objects and arrays: objects are merged key
 * by key and arrays of the same length item by item; other values come from
 * the first part that changed them (e.g. filled in a default).
 */
const mergeOutputs = (outputs: readonly unknown[], input: unknown): unknown => {
  if (outputs.every(isPlainRecord)) {
    const records = outputs as Record<string, unknown>[];
    const merged: Record<string, unknown> = {};
    for (const record of records) {
      for (const key of Object.keys(record)) {
        if (hasOwn(merged, key)) continue;
        setOwn(
          merged,
          key,
          mergeOutputs(
            records
              .filter((other) => hasOwn(other, key))
              .map((other) => other[key]),
            isPlainRecord(input) ? getOwn(input, key) : undefined,
          ),
        );
      }
    }
    return merged;
  }
  if (
    outputs.every(
      (output) =>
        Array.isArray(output) &&
        output.length === (outputs[0] as unknown[]).length,
    )
  ) {
    const arrays = outputs as unknown[][];
    return arrays[0].map((_, index) =>
      mergeOutputs(
        arrays.map((array) => array[index]),
        Array.isArray(input) ? input[index] : undefined,
      ),
    );
  }
  return outputs.find((output) => output !== input) ?? outputs[0];
};

/** Every validator must pass; object outputs are merged. */
const allOf = (validators: readonly AnyValidator[]): AnyValidator =>
  validators.length === 1
    ? validators[0]
    : createValidator(
        (value, ctx) => {
          const issues: RunOutput["issues"][number][] = [];
          const outputs: unknown[] = [];
          return andThen(
            runChildren(
              validators,
              (validator) => validator["~run"](value, ctx),
              (_, result) => {
                outputs.push(result.value);
                appendIssues(issues, result.issues);
              },
              ctx,
              false,
            ),
            (): RunOutput => ({
              value: issues.length > 0 ? value : mergeOutputs(outputs, value),
              issues,
            }),
          );
        },
        {
          isOptional: false,
          get isAsync() {
            return validators.some((validator) => validator.isAsync);
          },
        },
        { kind: "allOf", options: validators },
      );

/** Exactly one validator must pass (JSON Schema oneOf). */
const oneOf = (validators: readonly AnyValidator[]): AnyValidator =>
  createValidator(
    (value, ctx) => {
      const passed: unknown[] = [];
      return andThen(
        runChildren(
          validators,
          (validator) => validator["~run"](value, ctx),
          (_, result) => {
            if (result.issues.length === 0) passed.push(result.value);
          },
          ctx,
          false,
        ),
        (): RunOutput =>
          passed.length === 1
            ? { value: passed[0], issues: [] }
            : {
                value,
                issues: [
                  passed.length === 0
                    ? createIssue("union", en.union, ctx.path)
                    : createIssue("oneOf", en.oneOf, ctx.path, {
                        matches: passed.length,
                      }),
                ],
              },
      );
    },
    {
      isOptional: false,
      get isAsync() {
        return validators.some((validator) => validator.isAsync);
      },
    },
    { kind: "oneOf", options: validators },
  );

/** Uses a copy of `value` when the input is undefined (JSON semantics). */
const withDefault = (validator: AnyValidator, value: unknown): AnyValidator => {
  const fresh = constantOf(value);
  return createValidator(
    (input, ctx) =>
      validator["~run"](input === undefined ? fresh() : input, ctx),
    {
      isOptional: true,
      get isAsync() {
        return validator.isAsync;
      },
    },
    { kind: "context", inner: validator },
  );
};

// ---------- rules --------------------------------------------------------

const valueRule = (
  code: string,
  message: string,
  params: Record<string, unknown>,
  check: (value: unknown) => boolean,
) => createRule<unknown>({ code, message, params, check });

const enumRule = (values: readonly unknown[]) => {
  // A copy: changing the schema later can't change the validator.
  const options = [...values];
  return valueRule("enum", en.enumOf(options), { options }, (value) =>
    options.some((option) => deepEqual(value, option)),
  );
};

const constRule = (expected: unknown) =>
  valueRule("literal", en.literal(expected), { expected }, (value) =>
    deepEqual(value, expected),
  );

// Any version and variant, also the nil UUID (format "uuid" is RFC 4122).
const ANY_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * multipleOf compares the quotient with the nearest whole number, allowing a
 * few units of float rounding: 19.99 / 0.01 is 1998.9999999999998, and
 * 19.99 % 0.01 isn't 0 at all.
 */
const isMultipleOf = (value: number, divisor: number): boolean => {
  const quotient = value / divisor;
  return (
    Number.isFinite(quotient) &&
    Math.abs(quotient - Math.round(quotient)) <=
      Math.abs(quotient) * Number.EPSILON * 8
  );
};

const multipleOfRule = (divisor: number) =>
  createRule<number>({
    code: "number.divisibleBy",
    params: { divisor },
    message: en.divisibleBy(divisor),
    check: (value) => isMultipleOf(value, divisor),
  });

/** JSON Schema counts string length in code points, not UTF-16 units. */
const codePoints = (text: string): number => {
  let count = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    // A high surrogate followed by a low one is one code point.
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) i++;
    }
    count++;
  }
  return count;
};

const lengthRule = (bound: "min" | "max", limit: number) =>
  createRule<string>({
    code: bound === "min" ? "string.minLength" : "string.maxLength",
    params: bound === "min" ? { min: limit } : { max: limit },
    message:
      bound === "min" ? en.stringMinLength(limit) : en.stringMaxLength(limit),
    check: (value) =>
      bound === "min" ? codePoints(value) >= limit : codePoints(value) <= limit,
  });

/**
 * A key for values that come from JSON (objects with sorted keys), so
 * uniqueItems compares items through a Map in linear time; undefined for
 * other values, which are compared one by one.
 */
const jsonKey = (value: unknown): string | undefined => {
  if (value === null || typeof value !== "object") {
    // -0 and 0 are the same JSON number.
    return typeof value === "number"
      ? `n${value === 0 ? 0 : value}`
      : typeof value === "string"
        ? `s${value}`
        : typeof value === "boolean" || value === null
          ? `l${value}`
          : undefined;
  }
  if (Array.isArray(value)) {
    const items: string[] = [];
    for (let i = 0; i < value.length; i++) {
      const key = jsonKey(value[i]);
      if (key === undefined) return undefined;
      items.push(key);
    }
    return `[${items.join(",")}]`;
  }
  if (!isPlainRecord(value)) return undefined;
  const entries: string[] = [];
  for (const name of Object.keys(value).sort()) {
    const key = jsonKey(value[name]);
    if (key === undefined) return undefined;
    entries.push(`${JSON.stringify(name)}:${key}`);
  }
  return `{${entries.join(",")}}`;
};

const uniqueItemsRule = () =>
  createRule<unknown[]>({
    code: "array.unique",
    message: en.unique,
    check: (items) => {
      const seen = new Set<string>();
      const others: unknown[] = [];
      for (const item of items) {
        const key = jsonKey(item);
        if (key !== undefined) {
          if (seen.has(key)) return false;
          seen.add(key);
        } else if (others.some((other) => deepEqual(item, other))) {
          return false;
        } else {
          others.push(item);
        }
      }
      return true;
    },
  });

const formatRule = (format: string) => {
  const rule = (
    code: string,
    message: string,
    check: (text: string) => boolean,
  ) => createRule<string>({ code, message, check });
  switch (format) {
    case "email":
      return email();
    case "uri":
      return rule("string.url", en.url, (text) => parseUrl(text) !== undefined);
    case "uuid":
      return rule("string.uuid", en.uuid, (text) => ANY_UUID.test(text));
    case "date":
      return date();
    case "date-time":
      return dateTime();
    case "ipv4":
      return ip(4);
    case "ipv6":
      return ip(6);
    default:
      // Other formats are notes in JSON Schema 2020-12.
      return undefined;
  }
};

// ---------- compiling ----------------------------------------------------

const decodeToken = (token: string, ref: string) => {
  try {
    return decodeURIComponent(token).replace(/~1/g, "/").replace(/~0/g, "~");
  } catch {
    throw invalidSchema(`invalid $ref ${ref}.`);
  }
};

/** Resolves a local JSON pointer such as "#/components/schemas/User". */
const resolvePointer = (root: unknown, ref: string): unknown => {
  // "#" or "#/...": anchors ("#node") and other documents aren't supported.
  if (ref !== "#" && !ref.startsWith("#/")) {
    throw invalidSchema(
      `only local JSON pointer $ref values are supported, got ${ref}.`,
    );
  }
  const tokens = ref
    .slice(1)
    .split("/")
    .slice(1)
    .map((token) => decodeToken(token, ref));
  return tokens.reduce<unknown>((node, token) => {
    if (!isPlainObject(node) && !Array.isArray(node)) {
      throw invalidSchema(`can't resolve $ref ${ref}.`);
    }
    if (!hasOwn(node, token)) throw invalidSchema(`can't resolve $ref ${ref}.`);
    return getOwn(node as Record<string, unknown>, token);
  }, root);
};

const compileRef = (ref: string, ctx: Context): AnyValidator => {
  const known = ctx.refs.get(ref);
  if (known) return known;

  // Registered before compiling, so recursive references reuse it.
  const target: { validator?: AnyValidator } = {};
  const validator = createLazyValidator(() => target.validator!);
  ctx.refs.set(ref, validator);
  target.validator = compile(
    resolvePointer(ctx.root, ref) as JsonSchemaDefinition,
    ctx,
  );
  return validator;
};

const compileString = (schema: JsonSchema): AnyValidator => {
  let validator = createStringValidator();
  if (schema.minLength !== undefined) {
    validator = validator.with(lengthRule("min", schema.minLength));
  }
  if (schema.maxLength !== undefined) {
    validator = validator.with(lengthRule("max", schema.maxLength));
  }
  if (schema.pattern !== undefined) {
    let pattern: RegExp;
    try {
      pattern = new RegExp(schema.pattern, "u");
    } catch {
      throw invalidSchema(`invalid pattern ${JSON.stringify(schema.pattern)}.`);
    }
    validator = validator.regexMatch(pattern);
  }
  const format = schema.format && formatRule(schema.format);
  return format ? validator.with(format) : validator;
};

const compileNumber = (schema: JsonSchema): AnyValidator => {
  let validator = createNumberValidator();
  if (schema.type === "integer") validator = validator.integer();
  const { exclusiveMinimum: exMin, exclusiveMaximum: exMax } = schema;
  if (schema.minimum !== undefined) {
    validator =
      exMin === true
        ? validator.with(greaterThan(schema.minimum))
        : validator.minimum(schema.minimum);
  }
  if (schema.maximum !== undefined) {
    validator =
      exMax === true
        ? validator.with(lessThan(schema.maximum))
        : validator.maximum(schema.maximum);
  }
  if (typeof exMin === "number") {
    validator = validator.with(greaterThan(exMin));
  }
  if (typeof exMax === "number") {
    validator = validator.with(lessThan(exMax));
  }
  if (schema.multipleOf !== undefined) {
    validator = validator.with(multipleOfRule(schema.multipleOf));
  }
  return validator;
};

/**
 * prefixItems validate the positions that exist, items the ones after (any
 * value without items); the outputs are kept, so defaults are filled in.
 */
const prefixCombinator = (
  prefix: readonly AnyValidator[],
  rest: AnyValidator | undefined,
): Combinator => ({
  meta: { kind: "array", item: rest, prefix },
  get isAsync() {
    return prefix.some((item) => item.isAsync) || Boolean(rest?.isAsync);
  },
  run: (value: unknown[], ctx, { abortEarly }) => {
    const issues: RunOutput["issues"][number][] = [];
    const output: unknown[] = [];
    return andThen(
      runChildren(
        value,
        (element, index) => {
          const item = index < prefix.length ? prefix[index] : rest;
          return item
            ? item["~run"](element, childContext(ctx, index, ctx.data))
            : { value: element, issues: [] };
        },
        (_, result) => {
          appendIssues(issues, result.issues);
          output.push(result.value);
        },
        ctx,
        abortEarly,
      ),
      () => ({ value: output, issues }),
    );
  },
});

const compileArray = (schema: JsonSchema, ctx: Context): AnyValidator => {
  const prefix =
    schema.prefixItems === undefined
      ? []
      : compileList(schema.prefixItems, "prefixItems", ctx, true);
  const rest =
    schema.items === undefined ? undefined : compile(schema.items, ctx);

  let validator: ArrayValidator<unknown[]> =
    prefix.length > 0
      ? extendValidator<unknown[], typeof arrayRules>(arrayRules)(
          createState("array", Array.isArray, {
            children: prefixCombinator(prefix, rest),
          }),
        )
      : ((rest
          ? createArrayValidator(rest)
          : createArrayValidator()) as ArrayValidator<unknown[]>);
  if (schema.minItems !== undefined) {
    validator = validator.minLength(schema.minItems);
  }
  if (schema.maxItems !== undefined) {
    validator = validator.maxLength(schema.maxItems);
  }
  if (schema.uniqueItems === true) {
    // JSON Schema compares items by value, not by reference.
    validator = validator.with(uniqueItemsRule());
  }
  return validator;
};

const compileObject = (schema: JsonSchema, ctx: Context): AnyValidator => {
  if (
    schema.required !== undefined &&
    (!Array.isArray(schema.required) ||
      !schema.required.every((key) => typeof key === "string"))
  ) {
    throw invalidSchema("required must be a list of property names.");
  }
  if (schema.properties !== undefined && !isPlainRecord(schema.properties)) {
    throw invalidSchema("properties must be an object.");
  }
  const required = new Set(schema.required ?? []);
  const shape: Shape = {};

  for (const [key, property] of Object.entries(schema.properties ?? {})) {
    const validator = compile(property, ctx);
    const defaultValue =
      typeof property === "object" ? property.default : undefined;
    // A field with a default is filled in when missing (already optional).
    const field =
      ctx.useDefaults && defaultValue !== undefined
        ? withDefault(validator, defaultValue)
        : required.has(key)
          ? validator
          : toOptional(validator, false);
    setOwn(shape, key, field);
  }
  // Required keys without a property schema may hold any value.
  for (const key of required) {
    if (!hasOwn(shape, key)) setOwn(shape, key, createUnknownValidator());
  }

  const { additionalProperties } = schema;
  // JSON objects only: a Map, Set or class instance isn't a JSON object.
  return createObjectWithTypeCheck(
    shape,
    isPlainRecord,
    additionalProperties === false
      ? "strict"
      : additionalProperties === undefined || additionalProperties === true
        ? "passthrough"
        : // A schema validates the other keys and keeps their outputs.
          compile(additionalProperties, ctx),
  );
};

/** Compiles a schema with a single type; unknown types are rejected. */
const compileType = (schema: JsonSchema, ctx: Context): AnyValidator => {
  if (typeof schema.type !== "string" || !SCHEMA_TYPES.includes(schema.type)) {
    throw invalidSchema(
      `unsupported type ${JSON.stringify(schema.type)}; expected one of ${SCHEMA_TYPES.join(
        ", ",
      )}.`,
    );
  }
  switch (schema.type) {
    case "string":
      return compileString(schema);
    case "number":
    case "integer":
      return compileNumber(schema);
    case "boolean":
      return createBooleanValidator();
    case "null":
      return createNullValidator();
    case "array":
      return compileArray(schema, ctx);
    default:
      return compileObject(schema, ctx);
  }
};

const compileTypes = (
  schema: JsonSchema,
  ctx: Context,
): AnyValidator | undefined => {
  const { type } = schema;
  if (type === undefined) return undefined;
  if (!Array.isArray(type)) return compileType(schema, ctx);
  if (type.length === 0) throw invalidSchema("type must not be empty.");
  const [first, ...rest] = type.map((each) =>
    compileType({ ...schema, type: each }, ctx),
  );
  return rest.length === 0 ? first : createUnionValidator([first, ...rest]);
};

const compileList = (
  list: readonly JsonSchemaDefinition[],
  keyword: string,
  ctx: Context,
  allowEmpty = false,
): AnyValidator[] => {
  if (!Array.isArray(list)) throw invalidSchema(`${keyword} must be a list.`);
  if (list.length === 0 && !allowEmpty) {
    throw invalidSchema(`${keyword} must not be empty.`);
  }
  return list.map((schema) => compile(schema, ctx));
};

const has = (schema: JsonSchema, keywords: readonly string[]) =>
  keywords.some((keyword) => schema[keyword] !== undefined);

const STRING_KEYWORDS = ["minLength", "maxLength", "pattern", "format"];
const NUMBER_KEYWORDS = [
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
];
const ARRAY_KEYWORDS = [
  "items",
  "prefixItems",
  "minItems",
  "maxItems",
  "uniqueItems",
];
const OBJECT_KEYWORDS = ["properties", "required", "additionalProperties"];

/**
 * Without type, the keywords of each type apply to values of that type:
 * { maxLength: 2 } accepts numbers, { required: ["a"] } accepts strings.
 */
const compileUntyped = (schema: JsonSchema, ctx: Context): AnyValidator[] => [
  ...(has(schema, STRING_KEYWORDS)
    ? [whenType((value) => typeof value === "string", compileString(schema))]
    : []),
  ...(has(schema, NUMBER_KEYWORDS)
    ? [whenType((value) => typeof value === "number", compileNumber(schema))]
    : []),
  ...(has(schema, ARRAY_KEYWORDS)
    ? [whenType(Array.isArray, compileArray(schema, ctx))]
    : []),
  ...(has(schema, OBJECT_KEYWORDS)
    ? [whenType(isPlainObject, compileObject(schema, ctx))]
    : []),
];

const compile = (
  definition: JsonSchemaDefinition,
  ctx: Context,
): AnyValidator => {
  if (definition === true) return createUnknownValidator();
  if (definition === false) {
    return createUnknownValidator().refine(
      () => false,
      en.jsonSchemaFalse,
      "jsonSchema.false",
    );
  }
  if (!isPlainObject(definition)) {
    throw invalidSchema("a schema must be an object or a boolean.");
  }
  const schema = definition as JsonSchema;

  // Every keyword that applies adds a validator; they must all pass.
  const parts: AnyValidator[] = [];
  if (schema.$ref !== undefined) {
    if (typeof schema.$ref !== "string") {
      throw invalidSchema("$ref must be a string.");
    }
    parts.push(compileRef(schema.$ref, ctx));
  }
  // Most parts report a missing value themselves, with one issue; these
  // don't (they accept it or report "union").
  let reportsMissing = true;
  const typed = compileTypes(schema, ctx);
  if (typed) parts.push(typed);
  else {
    const untyped = compileUntyped(schema, ctx);
    if (untyped.length > 0) reportsMissing = false;
    parts.push(...untyped);
  }
  if (schema.enum !== undefined) {
    if (!Array.isArray(schema.enum)) {
      throw invalidSchema("enum must be a list.");
    }
    parts.push(createUnknownValidator().with(enumRule(schema.enum)));
  }
  if (hasOwn(schema, "const")) {
    parts.push(createUnknownValidator().with(constRule(schema.const)));
  }
  if (schema.anyOf) {
    const [first, ...rest] = compileList(schema.anyOf, "anyOf", ctx);
    parts.push(
      rest.length === 0 ? first : createUnionValidator([first, ...rest]),
    );
  }
  if (schema.oneOf) {
    reportsMissing = false;
    parts.push(oneOf(compileList(schema.oneOf, "oneOf", ctx)));
  }
  if (schema.allOf) parts.push(...compileList(schema.allOf, "allOf", ctx));

  // A schema without type and other assertions accepts any value.
  const validator =
    parts.length === 0 ? createUnknownValidator() : allOf(parts);
  const result = schema.nullable === true ? nullableOf(validator) : validator;
  // One "required" issue for a missing value, not one per part.
  return parts.length > 1 || !reportsMissing ? presenceOf(result) : result;
};

/**
 * Builds an xoe validator from a JSON Schema. As in JSON Schema, a value is
 * missing only when it is undefined ("" and null are values), properties are
 * optional unless listed in `required`, and additional properties are kept
 * unless `additionalProperties` is false. Invalid or unsupported schemas
 * throw XOEUsageError INVALID_SCHEMA when the validator is built.
 *
 * The output type comes from the schema when it's written as a literal
 * (inline or `as const`), see FromJsonSchema; otherwise pass it:
 * `xoe.jsonSchema<User>(schema)`.
 */
export function createJsonSchemaValidator<
  const S extends JsonSchemaDefinition,
  const O extends JsonSchemaOptions = Record<never, never>,
>(
  schema: S,
  options?: O,
): Validator<
  FromJsonSchema<S, RootOf<S, O>, UsesDefaults<O>>,
  FromJsonSchemaInput<S, RootOf<S, O>, UsesDefaults<O>>,
  false
>;
export function createJsonSchemaValidator<T>(
  schema: JsonSchemaDefinition,
  options?: JsonSchemaOptions,
): Validator<T, T, false>;
export function createJsonSchemaValidator(
  schema: JsonSchemaDefinition,
  options: JsonSchemaOptions = {},
): Validator<unknown, unknown, false> {
  return withContext(
    compile(schema, {
      root: options.root ?? schema,
      useDefaults: options.useDefaults ?? false,
      refs: new Map(),
    }),
    { emptyValues: "undefined" },
  ) as Validator<unknown, unknown, false>;
}

type RootOf<S, O> = O extends { root: infer R } ? R : S;
type UsesDefaults<O> = O extends { useDefaults: true } ? true : false;
