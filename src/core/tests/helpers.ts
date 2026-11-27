import { MaybePromise, XOEValidationOutput } from "../validatorTypes.ts";
import { isPromise } from "../rule.ts";

/** Replaces issues with their messages, to keep assertions short. Sync results only. */
export const messagesOf = <T>(output: MaybePromise<XOEValidationOutput<T>>) => {
  if (isPromise(output)) throw new Error("messagesOf expects a sync result");
  const result = output as XOEValidationOutput<T>;
  return result.type === "error"
    ? {
        type: "error" as const,
        value: result.value.map((issue) => issue.message),
      }
    : result;
};

/** Expected success result, typed loosely so assertions don't need casts. */
export const expectedSuccess = <T>(
  value: T,
): { type: "success"; value: T } => ({
  type: "success",
  value,
});

/** Expected error result. */
export const expectedError = <E>(value: E): { type: "error"; value: E } => ({
  type: "error",
  value,
});
