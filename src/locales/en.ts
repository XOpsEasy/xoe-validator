import * as en from "../core/english.ts";
import { paramsOf as p } from "../core/format.ts";
import { XOEMessages } from "../core/messages.ts";

/**
 * English messages for every issue code of the built-in validators, for
 * localizeIssues. They're the default messages too (both come from
 * core/english.ts): use this catalog to switch back to English or as a base
 * for your own. Messages of your own rules (refine, superRefine, code
 * "custom") are kept: they're already written for your users.
 */
export const enMessages: XOEMessages = {
  required: en.required,
  type: (issue) => en.type(p(issue).expected),
  literal: (issue) => en.literal(p(issue).expected),
  enum: (issue) => en.enumOf(p(issue).options),
  union: en.union,
  oneOf: en.oneOf,
  discriminator: (issue) => en.discriminator(p(issue).key, p(issue).options),
  sameAs: (issue) => en.sameAs(p(issue).field),
  transform: en.transform,

  "string.minLength": (issue) => en.stringMinLength(p(issue).min),
  "string.maxLength": (issue) => en.stringMaxLength(p(issue).max),
  "string.length": (issue) => en.stringLength(p(issue).length),
  "string.regexMatch": en.regexMatch,
  "string.contains": (issue) => en.contains(p(issue).substring),
  "string.startsWith": (issue) => en.startsWith(p(issue).prefix),
  "string.endsWith": (issue) => en.endsWith(p(issue).suffix),
  "string.email": en.email,
  "string.url": en.url,
  "string.uuid": en.uuid,
  "string.date": en.isoDate,
  "string.dateTime": en.isoDateTime,
  "string.ip": (issue) => en.ip(p(issue).version),
  "string.digits": en.digits,

  "number.minimum": (issue) => en.minimum(p(issue).min),
  "number.maximum": (issue) => en.maximum(p(issue).max),
  "number.exclusiveMinimum": (issue) => en.exclusiveMinimum(p(issue).min),
  "number.exclusiveMaximum": (issue) => en.exclusiveMaximum(p(issue).max),
  "number.between": (issue) => en.numberBetween(p(issue).min, p(issue).max),
  "number.divisibleBy": (issue) => en.divisibleBy(p(issue).divisor),
  "number.integer": en.integer,
  "number.positive": en.positive,
  "number.nonNegative": en.nonNegative,
  "number.negative": en.negative,
  "number.maxDecimals": (issue) => en.maxDecimals(p(issue).max),
  "number.safeInteger": en.safeInteger,

  "boolean.isTrue": en.isTrue,

  "date.isBefore": (issue) => en.isBefore(p(issue).date),
  "date.isAfter": (issue) => en.isAfter(p(issue).date),
  "date.between": (issue) => en.dateBetween(p(issue).min, p(issue).max),
  "date.inFuture": en.inFuture,
  "date.inPast": en.inPast,
  "date.minAge": (issue) => en.minAge(p(issue).years),
  "date.maxAge": (issue) => en.maxAge(p(issue).years),

  "array.minLength": (issue) => en.arrayMinLength(p(issue).min),
  "array.maxLength": (issue) => en.arrayMaxLength(p(issue).max),
  "array.length": (issue) => en.arrayLength(p(issue).length),
  "array.nonEmpty": en.nonEmpty,
  "array.unique": en.unique,
  "array.uniqueBy": (issue) => en.uniqueBy(p(issue).key),
  "tuple.length": (issue) => en.tupleLength(p(issue).length),

  "object.strict": (issue) => en.strict(p(issue).allowedKeys),
  "object.requireOne": en.requireOne,
  "record.duplicateKey": (issue) => en.duplicateKey(p(issue).key),

  "file.maxSize": (issue) => en.maxSize(p(issue).max),
  "file.minSize": (issue) => en.minSize(p(issue).min),
  "file.accept": (issue) => en.accept(p(issue).types),

  "jsonSchema.false": en.jsonSchemaFalse,

  "rs.jmbg": en.rsJmbg,
  "rs.pib": en.rsPib,
  "rs.companyNumber": en.rsCompanyNumber,
};
