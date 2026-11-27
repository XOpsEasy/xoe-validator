import {
  createArrayValidator,
  createBooleanValidator,
  createDateValidator,
  createDiscriminatedUnionValidator,
  createEnumValidator,
  createFileValidator,
  createInstanceOfValidator,
  createJsonSchemaValidator,
  createLazyValidator,
  createLiteralValidator,
  createNumberValidator,
  createObjectValidator,
  createRecordValidator,
  createStringValidator,
  createTupleValidator,
  createUnionValidator,
  createUnknownValidator,
} from "./validators/index.ts";

/** Validators that convert raw input (forms, query params, JSON) first. */
const coerce = {
  string: () => createStringValidator({ coerce: true }),
  number: () => createNumberValidator({ coerce: true }),
  boolean: () => createBooleanValidator({ coerce: true }),
  date: () => createDateValidator({ coerce: true }),
};

/** All validators in one object; named exports below allow tree-shaking. */
const xoe = {
  string: createStringValidator,
  number: createNumberValidator,
  boolean: createBooleanValidator,
  date: createDateValidator,
  object: createObjectValidator,
  array: createArrayValidator,
  tuple: createTupleValidator,
  record: createRecordValidator,
  literal: createLiteralValidator,
  enum: createEnumValidator,
  union: createUnionValidator,
  discriminatedUnion: createDiscriminatedUnionValidator,
  lazy: createLazyValidator,
  unknown: createUnknownValidator,
  instanceOf: createInstanceOfValidator,
  file: createFileValidator,
  jsonSchema: createJsonSchemaValidator,
  coerce,
};

export default xoe;
export { xoe };

// Named exports: import only what you use, so bundlers can drop the rest.
// "enum" is a reserved word, so the named export is enumOf.
export {
  coerce,
  createArrayValidator as array,
  createBooleanValidator as boolean,
  createDateValidator as date,
  createDiscriminatedUnionValidator as discriminatedUnion,
  createEnumValidator as enumOf,
  createFileValidator as file,
  createInstanceOfValidator as instanceOf,
  createJsonSchemaValidator as jsonSchema,
  createLazyValidator as lazy,
  createLiteralValidator as literal,
  createNumberValidator as number,
  createObjectValidator as object,
  createRecordValidator as record,
  createStringValidator as string,
  createTupleValidator as tuple,
  createUnionValidator as union,
  createUnknownValidator as unknown,
};

export * from "./core/result.ts";
export { createIssue, createRule } from "./core/rule.ts";
export { defineValidator } from "./core/validator/index.ts";
// Rule registries, e.g. to share rule lists: xoe.string().with(...rules).
export {
  arrayRules,
  booleanRules,
  dateRules,
  fileRules,
  numberRules,
  rsRules,
  stringRules,
} from "./validators/index.ts";
export { toFieldErrors } from "./core/issues.ts";
export { localizeIssues } from "./core/messages.ts";
export { localized } from "./core/localized.ts";
export { enMessages } from "./locales/en.ts";
export { srMessages } from "./locales/sr.ts";
export { toJsonSchema } from "./validators/index.ts";
export { XOEUsageError } from "./core/errors.ts";
export type { StandardSchemaV1 } from "./core/standardSchema.ts";
export type { XOEUsageErrorCode } from "./core/errors.ts";

export type * from "./core/validatorTypes.ts";
export type { NotAsync } from "./core/result.ts";
export type { XOEFieldErrors } from "./core/issues.ts";
export type { XOEMessage, XOEMessages } from "./core/messages.ts";
export type {
  RuleConfig,
  RuleContext,
  RuleRegistry,
  RuleResult,
  RuleWithConfig,
  XOEIssueInput,
} from "./core/rule.ts";
export type {
  AnyAsync,
  EmptyValues,
  Infer,
  InferInput,
  IsAsync,
  OrAsync,
  ValidateArgs,
  ValidateAsyncOptions,
  ValidateOptions,
  Validator,
  XOEAnnotations,
} from "./core/validator/index.ts";
export type {
  ExtendedValidator,
  PipedValidator,
  PipeTarget,
  RefineOptions,
  StateTransforms,
  TransformedValidator,
  ValidatorDefinition,
  ValidatorFactory,
  ValidatorOptions,
} from "./core/validator/index.ts";
export type {
  ArrayValidator,
  BooleanValidator,
  DateTimeOptions,
  DateValidator,
  DiscriminatedInput,
  DiscriminatedOutput,
  EnumMembers,
  EnumValidator,
  FileValidator,
  FromJsonSchema,
  FromJsonSchemaInput,
  InstanceOfValidator,
  JsonSchema,
  JsonSchemaDefinition,
  JsonSchemaObject,
  JsonSchemaOptions,
  JsonSchemaType,
  Literal,
  LiteralValidator,
  NumberValidator,
  ObjectInput,
  ObjectMembers,
  ObjectOutput,
  ObjectValidator,
  PartialShape,
  RecordOutput,
  RecordValidator,
  RelativeDateOptions,
  Shape,
  ShapeAsync,
  StringValidator,
  ToJsonSchemaOptions,
  TupleInput,
  TupleOutput,
  TupleValidator,
  UnionValidator,
  UnknownValidator,
} from "./validators/index.ts";
