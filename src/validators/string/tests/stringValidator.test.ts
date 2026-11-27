import { expect, test } from "vitest";
import { messagesOf } from "../../../core/tests/helpers.ts";
import { expectedError, expectedSuccess } from "../../../core/tests/helpers.ts";
import xoe from "../../../index.ts";

test("StringValidator - sync rules pass", () => {
  const validator = xoe.string().minLength(3).maxLength(6);
  const result = validator.validate("hello");

  expect(result).toStrictEqual(expectedSuccess("hello"));
});

test("StringValidator - sync rules fail", () => {
  const validator = xoe.string().minLength(3);
  const result = validator.validate("hi");

  expect(messagesOf(result)).toStrictEqual(
    expectedError(["Must be at least 3 characters long."]),
  );
});
