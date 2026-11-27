import type {
  AnyValidator,
  CombinatorMeta,
  ValidatorState,
} from "../../core/validator/index.ts";
import { XOEUsageError } from "../../core/errors.ts";
import { isRefinement } from "../../core/rule.ts";
import { isConstant } from "../../core/copy.ts";

/** A JSON Schema object (JSON-serializable). */
export type JsonSchemaObject = { [keyword: string]: unknown };

export type ToJsonSchemaOptions = {
  /**
   * "draft-2020-12" (default) is also the schema dialect of OpenAPI 3.1;
   * "openapi-3.0" uses nullable, enum instead of const and boolean
   * exclusiveMinimum/exclusiveMaximum.
   */
  target?: "draft-2020-12" | "openapi-3.0";
  /**
   * What to do with validators JSON Schema can't describe (instanceOf, custom
   * types, recursion in OpenAPI 3.0): throw (default) or allow any value.
   */
  unrepresentable?: "throw" | "any";
};

type Context = {
  target: "draft-2020-12" | "openapi-3.0";
  unrepresentable: "throw" | "any";
  defs: Record<string, JsonSchemaObject>;
  /**
   * Lazy targets: name, whether they refer to themselves, and the schema once
   * converted (reused, so shared targets are converted once).
   */
  lazy: Map<
    AnyValidator,
    { name: string; recursive: boolean; schema?: JsonSchemaObject }
  >;
  inProgress: Set<AnyValidator>;
};

const DRAFT_2020_12 = "https://json-schema.org/draft/2020-12/schema";

const escapeRegex = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

const unrepresentable = (ctx: Context, what: string): JsonSchemaObject => {
  if (ctx.unrepresentable === "any") return {};
  throw new XOEUsageError(
    "UNREPRESENTABLE",
    `xoe.toJsonSchema: ${what} can't be described in JSON Schema; pass { unrepresentable: "any" } to allow any value there.`,
  );
};

const constant = (ctx: Context, value: unknown): JsonSchemaObject =>
  ctx.target === "openapi-3.0" ? { enum: [value] } : { const: value };

/**
 * Adds null to the accepted values: to `type`, and to `enum`/`const`, which
 * would reject it otherwise. OpenAPI 3.0 has no null type and its nullable
 * needs a type, so a schema without one gets null through its enum or anyOf.
 */
const nullable = (ctx: Context, input: JsonSchemaObject): JsonSchemaObject => {
  let schema = input;
  if (Array.isArray(schema.enum)) {
    schema = { ...schema, enum: [...schema.enum, null] };
  } else if ("const" in schema) {
    const { const: value, ...rest } = schema;
    schema = { ...rest, enum: [value, null] };
  }
  if (typeof schema.type === "string") {
    return ctx.target === "openapi-3.0"
      ? { ...schema, nullable: true }
      : { ...schema, type: [schema.type, "null"] };
  }
  if (Array.isArray(schema.enum)) return schema;
  const nullSchema =
    ctx.target === "openapi-3.0" ? { enum: [null] } : { type: "null" };
  // A union (only anyOf) gets null as one more option.
  return Object.keys(schema).length === 1 && Array.isArray(schema.anyOf)
    ? { anyOf: [...schema.anyOf, nullSchema] }
    : { anyOf: [schema, nullSchema] };
};

type Bound = { value: number; exclusive: boolean };

/** The stricter of two lower (or upper) bounds. */
const tighter = (
  current: Bound | undefined,
  next: Bound,
  side: "lower" | "upper",
): Bound => {
  if (!current) return next;
  if (next.value === current.value) {
    return next.exclusive ? next : current;
  }
  const stricter =
    side === "lower" ? next.value > current.value : next.value < current.value;
  return stricter ? next : current;
};

const lowerBound = (ctx: Context, { value, exclusive }: Bound) =>
  !exclusive
    ? { minimum: value }
    : ctx.target === "openapi-3.0"
      ? { minimum: value, exclusiveMinimum: true }
      : { exclusiveMinimum: value };

const upperBound = (ctx: Context, { value, exclusive }: Bound) =>
  !exclusive
    ? { maximum: value }
    : ctx.target === "openapi-3.0"
      ? { maximum: value, exclusiveMaximum: true }
      : { exclusiveMaximum: value };

/** A JSON Schema pattern: a regex source that also works with the u flag. */
const isUnicodePattern = (source: string): boolean => {
  try {
    new RegExp(source, "u");
    return true;
  } catch {
    return false;
  }
};

const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/**
 * The key of a numeric discriminator: the validator matches a number by its
 * string form, so "1" accepts 1, but "01" and "1.0" don't.
 */
const isNumericKey = (key: string): boolean =>
  Number.isFinite(Number(key)) && String(Number(key)) === key;

/** Keywords of the rules JSON Schema can describe; other rules are left out. */
const ruleKeywords = (
  ctx: Context,
  state: ValidatorState,
): JsonSchemaObject => {
  const keywords: JsonSchemaObject = {};
  const patterns: string[] = [];
  let lower: Bound | undefined;
  let upper: Bound | undefined;
  const atLeast = (value: unknown, exclusive = false) => {
    if (isNumber(value)) lower = tighter(lower, { value, exclusive }, "lower");
  };
  const atMost = (value: unknown, exclusive = false) => {
    if (isNumber(value)) upper = tighter(upper, { value, exclusive }, "upper");
  };
  const set = (keyword: string, value: unknown) => {
    if (isNumber(value)) keywords[keyword] = value;
  };

  for (const { config } of state.rules) {
    // refine and superRefine may reuse a built-in code, but they are custom
    // checks: like other custom rules, they have no JSON Schema equivalent
    // (the schema is less strict than validation).
    if (isRefinement(config)) continue;
    // Params of the built-in rules, whose shape is known per code; a rule
    // of your own with a built-in code but other params is left out.
    // oxlint-disable-next-line typescript/no-explicit-any
    const params = (config.params ?? {}) as Record<string, any>;
    switch (config.code) {
      case "string.minLength":
        set("minLength", params.min);
        break;
      case "string.maxLength":
        set("maxLength", params.max);
        break;
      case "string.length":
        set("minLength", params.length);
        set("maxLength", params.length);
        break;
      case "string.regexMatch":
        // JSON Schema patterns use the u flag; other flags (e.g. "i") have
        // no equivalent, and a source that's invalid with u is left out.
        if (
          typeof params.pattern === "string" &&
          (params.flags === "" || params.flags === "u") &&
          isUnicodePattern(params.pattern)
        ) {
          patterns.push(params.pattern);
        }
        break;
      case "string.contains":
        if (typeof params.substring === "string") {
          patterns.push(escapeRegex(params.substring));
        }
        break;
      case "string.startsWith":
        if (typeof params.prefix === "string") {
          patterns.push(`^${escapeRegex(params.prefix)}`);
        }
        break;
      case "string.endsWith":
        if (typeof params.suffix === "string") {
          patterns.push(`${escapeRegex(params.suffix)}$`);
        }
        break;
      case "string.email":
        keywords.format = "email";
        break;
      case "string.url":
        keywords.format = "uri";
        break;
      case "string.uuid":
        keywords.format = "uuid";
        break;
      case "string.date":
        keywords.format = "date";
        break;
      case "string.dateTime":
        // date-time requires an offset; local date-times have none.
        if (!params.local) keywords.format = "date-time";
        break;
      case "string.ip":
        if (params.version === undefined) {
          keywords.anyOf = [{ format: "ipv4" }, { format: "ipv6" }];
        } else {
          keywords.format = `ipv${params.version}`;
        }
        break;
      case "string.digits":
        patterns.push("^[0-9]+$");
        break;
      // Country rules: the length; JSON Schema can't check the check digit.
      case "rs.jmbg":
        patterns.push("^[0-9]{13}$");
        break;
      case "rs.pib":
        patterns.push("^[0-9]{9}$");
        break;
      case "rs.companyNumber":
        patterns.push("^[0-9]{8}$");
        break;
      case "number.maxDecimals":
        if (params.max === 0) keywords.type = "integer";
        // Validators check multipleOf by division: give them a tolerance
        // (Ajv: multipleOfPrecision), or 0.29 fails multipleOf 0.01.
        else if (isNumber(params.max)) {
          keywords.multipleOf ??= Number(`1e-${params.max}`);
        }
        break;
      case "number.safeInteger":
        keywords.type = "integer";
        atLeast(Number.MIN_SAFE_INTEGER);
        atMost(Number.MAX_SAFE_INTEGER);
        break;
      case "number.exclusiveMinimum":
        atLeast(params.min, true);
        break;
      case "number.exclusiveMaximum":
        atMost(params.max, true);
        break;
      case "enum":
        if (Array.isArray(params.options)) keywords.enum = [...params.options];
        break;
      case "literal":
        if ("expected" in params) {
          Object.assign(keywords, constant(ctx, params.expected));
        }
        break;
      case "number.minimum":
        atLeast(params.min);
        break;
      case "number.maximum":
        atMost(params.max);
        break;
      case "number.between":
        atLeast(params.min);
        atMost(params.max);
        break;
      case "number.positive":
        atLeast(0, true);
        break;
      case "number.nonNegative":
        atLeast(0);
        break;
      case "number.negative":
        atMost(0, true);
        break;
      case "number.divisibleBy":
        set("multipleOf", params.divisor);
        break;
      case "number.integer":
        keywords.type = "integer";
        break;
      case "boolean.isTrue":
        Object.assign(keywords, constant(ctx, true));
        break;
      case "array.minLength":
        set("minItems", params.min);
        break;
      case "array.maxLength":
        set("maxItems", params.max);
        break;
      case "array.length":
        set("minItems", params.length);
        set("maxItems", params.length);
        break;
      case "array.nonEmpty":
        keywords.minItems = Math.max(Number(keywords.minItems ?? 0), 1);
        break;
      case "array.unique":
        keywords.uniqueItems = true;
        break;
      case "object.requireOne":
        if (Array.isArray(params.keys)) {
          keywords.anyOf = (params.keys as string[]).map((key) => ({
            required: [key],
          }));
        }
        break;
      // Async rules and other custom rules have no JSON Schema
      // equivalent: the schema is less strict than validation.
    }
  }

  if (lower) Object.assign(keywords, lowerBound(ctx, lower));
  if (upper) Object.assign(keywords, upperBound(ctx, upper));
  if (patterns.length === 1) keywords.pattern = patterns[0];
  if (patterns.length > 1) {
    keywords.allOf = patterns.map((pattern) => ({ pattern }));
  }
  return keywords;
};

const fromChildren = (
  ctx: Context,
  meta: CombinatorMeta | undefined,
): JsonSchemaObject => {
  switch (meta?.kind) {
    case "object": {
      const properties: JsonSchemaObject = {};
      const required: string[] = [];
      for (const [key, field] of Object.entries(meta.shape)) {
        properties[key] = convert(ctx, field);
        if (!field.isOptional) required.push(key);
      }
      return {
        type: "object",
        ...(Object.keys(properties).length > 0 ? { properties } : {}),
        ...(required.length > 0 ? { required } : {}),
        ...(meta.unknownKeys === "strict"
          ? { additionalProperties: false }
          : meta.catchall
            ? { additionalProperties: convert(ctx, meta.catchall) }
            : {}),
      };
    }
    case "record":
      return {
        type: "object",
        ...(meta.key ? { propertyNames: convert(ctx, meta.key) } : {}),
        additionalProperties: convert(ctx, meta.value),
      };
    case "discriminated":
      return {
        oneOf: Object.entries(meta.options).map(([value, option]) => {
          const schema = convert(ctx, option);
          // A numeric key also accepts the number (see discriminatedUnion).
          const accepted = isNumericKey(value)
            ? { enum: [value, Number(value)] }
            : constant(ctx, value);
          const properties = (schema.properties as JsonSchemaObject) ?? {};
          const required = (schema.required as string[]) ?? [];
          // The key's own schema in the option (e.g. a shared base with
          // xoe.string()) would accept every option's value.
          return {
            ...schema,
            properties: { ...properties, [meta.key]: accepted },
            required: [...new Set([meta.key, ...required])],
          };
        }),
      };
    case "union":
      return { anyOf: meta.options.map((option) => convert(ctx, option)) };
    case "tuple": {
      const items = meta.items.map((item) => convert(ctx, item));
      // Items up to the last required one must be present.
      const requiredCount = meta.items.reduce(
        (count, item, index) => (item.isOptional ? count : index + 1),
        0,
      );
      return ctx.target === "openapi-3.0"
        ? {
            type: "array",
            items: { anyOf: items },
            minItems: requiredCount,
            maxItems: items.length,
          }
        : {
            type: "array",
            prefixItems: items,
            items: false,
            minItems: requiredCount,
          };
    }
    case "array":
      // prefixItems has no OpenAPI 3.0 equivalent: there only the type is
      // described (less strict).
      if (meta.prefix && ctx.target === "openapi-3.0") return { type: "array" };
      return {
        type: "array",
        ...(meta.prefix
          ? { prefixItems: meta.prefix.map((item) => convert(ctx, item)) }
          : {}),
        ...(meta.item ? { items: convert(ctx, meta.item) } : {}),
      };
    default:
      return { type: "object" };
  }
};

const byType = (ctx: Context, state: ValidatorState): JsonSchemaObject => {
  // oxlint-disable-next-line typescript/no-explicit-any
  const params = (state.typeParams ?? {}) as Record<string, any>;
  switch (state.type) {
    case "string":
      return { type: "string" };
    case "number":
      return { type: "number" };
    case "boolean":
      return { type: "boolean" };
    case "date":
      return { type: "string", format: "date-time" };
    case "null":
      return { type: "null" };
    case "unknown":
      return {};
    case "file":
      return { type: "string", format: "binary" };
    case "literal":
      return constant(ctx, params.expected);
    case "enum":
      return { enum: [...params.options] };
    case "object":
    case "array":
    case "tuple":
    case "union":
      return fromChildren(ctx, state.children?.meta);
    default:
      return unrepresentable(ctx, `the "${state.type}" validator`);
  }
};

/** meta()/describe(); OpenAPI 3.0 has `example` (one) instead of `examples`. */
const annotationKeywords = (
  ctx: Context,
  annotations: ValidatorState["annotations"] = {},
): JsonSchemaObject => {
  const { title, description, examples, deprecated } = annotations;
  return {
    ...(title !== undefined ? { title } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(examples !== undefined && examples.length > 0
      ? ctx.target === "openapi-3.0"
        ? { example: examples[0] }
        : { examples: [...examples] }
      : {}),
    ...(deprecated !== undefined ? { deprecated } : {}),
  };
};

const fromState = (ctx: Context, state: ValidatorState): JsonSchemaObject => {
  let schema: JsonSchemaObject = {
    ...byType(ctx, state),
    ...ruleKeywords(ctx, state),
  };
  if (state.nullable) schema = nullable(ctx, schema);
  // Only a fixed default: a function default makes a new value on every use
  // (and may be async or have side effects), so it isn't called here.
  if (state.defaultValue && isConstant(state.defaultValue)) {
    schema = { ...schema, default: state.defaultValue() };
  }
  return { ...schema, ...annotationKeywords(ctx, state.annotations) };
};

const fromLazy = (ctx: Context, target: AnyValidator): JsonSchemaObject => {
  const known = ctx.lazy.get(target);
  if (known && ctx.inProgress.has(target)) {
    // OpenAPI 3.0 has no $defs: allow any value here (or throw).
    if (ctx.target === "openapi-3.0") {
      return unrepresentable(ctx, "a recursive schema in OpenAPI 3.0");
    }
    // A schema that refers to itself: describe it once under $defs.
    known.recursive = true;
    return { $ref: `#/$defs/${known.name}` };
  }
  // Converted before: reuse it, so shared targets aren't converted again
  // (and again for every path to them).
  // A copy for every place, so post-processing one place (e.g. adding a
  // description) doesn't change the others.
  if (known?.schema) {
    return known.recursive
      ? { $ref: `#/$defs/${known.name}` }
      : structuredClone(known.schema);
  }

  const entry = known ?? {
    name: `Schema${ctx.lazy.size + 1}`,
    recursive: false,
  };
  ctx.lazy.set(target, entry);
  ctx.inProgress.add(target);
  const schema = convert(ctx, target);
  ctx.inProgress.delete(target);
  entry.schema = schema;

  if (!entry.recursive) return schema;
  ctx.defs[entry.name] = schema;
  return { $ref: `#/$defs/${entry.name}` };
};

const convert = (ctx: Context, validator: AnyValidator): JsonSchemaObject => {
  const meta = validator["~meta"];
  switch (meta?.kind) {
    case "state":
      return fromState(ctx, meta.state);
    case "pipe":
      // The input side: what the first validator accepts.
      return convert(ctx, meta.first);
    case "context":
    case "optional":
      return convert(ctx, meta.inner);
    case "lazy":
      return fromLazy(ctx, meta.resolve());
    case "allOf":
      return { allOf: meta.options.map((option) => convert(ctx, option)) };
    case "oneOf":
      return { oneOf: meta.options.map((option) => convert(ctx, option)) };
    default:
      return unrepresentable(ctx, "this validator");
  }
};

/**
 * Describes a validator as a JSON Schema, e.g. for OpenAPI documentation,
 * form generators or LLM structured output. Rules without a JSON Schema
 * equivalent (refine, superRefine, async rules) are left out, so the schema
 * is less strict than the validator; transform and pipe describe the input.
 */
export const toJsonSchema = (
  validator: AnyValidator,
  options: ToJsonSchemaOptions = {},
): JsonSchemaObject => {
  const ctx: Context = {
    target: options.target ?? "draft-2020-12",
    unrepresentable: options.unrepresentable ?? "throw",
    defs: {},
    lazy: new Map(),
    inProgress: new Set(),
  };
  const schema = convert(ctx, validator);
  const defs = Object.keys(ctx.defs).length > 0 ? { $defs: ctx.defs } : {};

  return ctx.target === "draft-2020-12"
    ? { $schema: DRAFT_2020_12, ...schema, ...defs }
    : { ...schema, ...defs };
};
