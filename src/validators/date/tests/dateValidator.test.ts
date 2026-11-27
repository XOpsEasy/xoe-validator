import { expect, test } from "vitest";
import { messagesOf } from "../../../core/tests/helpers.ts";
import { expectedError, expectedSuccess } from "../../../core/tests/helpers.ts";
import xoe from "../../../index.ts";

test("DateValidator - valid date passes all rules", () => {
  const validator = xoe
    .date()
    .isAfter(new Date(2023, 0, 1))
    .isBefore(new Date(2023, 11, 31));

  const result = validator.validate(new Date(2023, 5, 15));

  expect(result).toStrictEqual(expectedSuccess(new Date(2023, 5, 15)));
});

test("DateValidator - an invalid date fails the type check", () => {
  const validator = xoe.date();

  const result = validator.validate(new Date("invalid"));

  expect(messagesOf(result)).toStrictEqual(
    expectedError(["Value must be a valid date."]),
  );
});

test("DateValidator - date before minDate fails isAfter", () => {
  const validator = xoe.date().isAfter(new Date(2023, 0, 1));

  const result = validator.validate(new Date(2022, 11, 31));

  expect(messagesOf(result)).toStrictEqual(
    expectedError([`Must be after 2023-01-01.`]),
  );
});

test("DateValidator - date after maxDate fails isBefore", () => {
  const validator = xoe.date().isBefore(new Date(2023, 11, 31));

  const result = validator.validate(new Date(2024, 0, 1));

  expect(messagesOf(result)).toStrictEqual(
    expectedError([`Must be before 2023-12-31.`]),
  );
});
