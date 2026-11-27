import { expectedError, expectedSuccess } from "../../../core/tests/helpers.ts";
import { expect, test } from "vitest";
import { messagesOf } from "../../../core/tests/helpers.ts";
import xoe from "../../../index.ts";

test("NumberValidator - sync rules pass", () => {
  const validator = xoe.number().minimum(4).maximum(10);
  const result = validator.validate(5);
  expect(result).toStrictEqual(expectedSuccess(5));
});

test("NumberValidator - sync rules fail", () => {
  const validator = xoe.number().minimum(3).maximum(22);
  const result = validator.validate(1);
  expect(messagesOf(result)).toStrictEqual(
    expectedError(["Must be greater than or equal to 3."]),
  );
});
