import {
  MaybePromise,
  XOEError,
  XOEResult,
  XOESuccess,
} from "./validatorTypes.ts";

const SUCCESS_TYPE = "success" as const;
const ERROR_TYPE = "error" as const;

export const xoeError = <E, T = never>(value: E): XOEResult<T, E> => ({
  type: ERROR_TYPE,
  value,
});

export const xoeSuccess = <T, E = never>(value: T): XOEResult<T, E> => ({
  type: SUCCESS_TYPE,
  value,
});

export const isXOEError = <T, E>(
  result: XOEResult<T, E>,
): result is XOEError<E> => result.type === ERROR_TYPE;

export const isXOESuccess = <T, E>(
  result: XOEResult<T, E>,
): result is XOESuccess<T> => result.type === SUCCESS_TYPE;

export const fold = <T, E, R>(
  result: XOEResult<T, E>,
  onError: (error: E) => R,
  onSuccess: (value: T) => R,
): R =>
  result.type === ERROR_TYPE ? onError(result.value) : onSuccess(result.value);

/**
 * Makes a function that returns a promise a type error where a promise would
 * end up inside the result (a success holding a promise, rejections lost).
 */
export type NotAsync<B> = [B] extends [PromiseLike<unknown>]
  ? "xoe: async functions are not supported here, use flatMapAsync or fromPromise"
  : unknown;

/** Maps the value; a type error for async functions (use flatMapAsync). */
export const map = <A, B, E>(
  result: XOEResult<A, E>,
  fn: (value: A) => B & NotAsync<B>,
): XOEResult<B, E> =>
  result.type === SUCCESS_TYPE
    ? xoeSuccess(fn(result.value))
    : xoeError(result.value);

export const flatMap = <A, B, E>(
  result: XOEResult<A, E>,
  fn: (value: A) => XOEResult<B, E>,
): XOEResult<B, E> =>
  result.type === SUCCESS_TYPE ? fn(result.value) : xoeError(result.value);

/**
 * flatMap for async steps: the result and the step may be promises, and the
 * error types may differ. Errors short-circuit: fn is not called.
 */
export const flatMapAsync = async <A, B, E, F = E>(
  result: MaybePromise<XOEResult<A, E>>,
  fn: (value: A) => MaybePromise<XOEResult<B, F>>,
): Promise<XOEResult<B, E | F>> => {
  const resolved = await result;
  return resolved.type === ERROR_TYPE ? resolved : await fn(resolved.value);
};

/** Maps the error; a type error for async functions. */
export const mapError = <T, E, F>(
  result: XOEResult<T, E>,
  fn: (error: E) => F & NotAsync<F>,
): XOEResult<T, F> =>
  result.type === ERROR_TYPE ? xoeError(fn(result.value)) : result;

/** Maps both sides: the error with onError, the value with onSuccess. */
export const bimap = <T, E, U, F>(
  result: XOEResult<T, E>,
  onError: (error: E) => F & NotAsync<F>,
  onSuccess: (value: T) => U & NotAsync<U>,
): XOEResult<U, F> =>
  result.type === ERROR_TYPE
    ? xoeError(onError(result.value))
    : xoeSuccess(onSuccess(result.value));

/** Turns code that may throw into a result; use fromPromise for async code. */
export const tryCatch = <T, E>(
  fn: () => T & NotAsync<T>,
  onError: (thrown: unknown) => E,
): XOEResult<T, E> => {
  try {
    return xoeSuccess(fn());
  } catch (thrown) {
    return xoeError(onError(thrown));
  }
};

/** Turns a promise that may reject into a promise of a result (never rejects). */
export const fromPromise = <T, E>(
  promise: PromiseLike<T>,
  onRejected: (reason: unknown) => E,
): Promise<XOEResult<T, E>> =>
  Promise.resolve(promise).then(
    (value) => xoeSuccess<T, E>(value),
    (reason) => xoeError<E, T>(onRejected(reason)),
  );

/** Waits for all results; succeeds with all values or fails with all errors combined. */
export const all = async <T, E>(
  results: MaybePromise<XOEResult<T, E[]>>[],
): Promise<XOEResult<T[], E[]>> => {
  const settled = await Promise.all(results);
  const errors = settled.filter(isXOEError).flatMap((result) => result.value);

  return errors.length > 0
    ? xoeError(errors)
    : xoeSuccess(settled.filter(isXOESuccess).map((result) => result.value));
};
