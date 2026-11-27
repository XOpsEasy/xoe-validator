export type XOEUsageErrorCode =
  /** validate() was called on a validator with async rules, transforms or defaults. */
  | "ASYNC_IN_SYNC"
  /** validateAsync() got a concurrency below 1 (or NaN). */
  | "INVALID_CONCURRENCY"
  /** A custom rule or member has the name of a built-in validator method. */
  | "NAME_CONFLICT"
  /** xoe.jsonSchema() got a schema it can't compile, e.g. an unknown type. */
  | "INVALID_SCHEMA"
  /** A default() or catch() object can't be copied (e.g. it has functions). */
  | "UNCOPYABLE_VALUE"
  /** toJsonSchema() got a validator JSON Schema can't describe. */
  | "UNREPRESENTABLE";

/**
 * Thrown when the library is used incorrectly. Invalid data never throws:
 * it is reported as XOEIssue objects in the result.
 */
export class XOEUsageError extends Error {
  override readonly name = "XOEUsageError";

  constructor(
    readonly code: XOEUsageErrorCode,
    message: string,
  ) {
    super(message);
  }
}
