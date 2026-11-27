import { expect, test } from "vitest";
import { messagesOf } from "../../../core/tests/helpers.ts";
import { isAfter, isBefore } from "../dateRules.ts";

test("isBefore rule", () => {
  const rule = isBefore(new Date(2023, 0, 1));
  expect(messagesOf(rule.execute(new Date(2022, 11, 31)))).toStrictEqual({
    type: "success",
    value: new Date(2022, 11, 31),
  });
  expect(messagesOf(rule.execute(new Date(2023, 0, 2)))).toStrictEqual({
    type: "error",
    value: ["Must be before 2023-01-01."],
  });
});

test("isAfter rule", () => {
  const rule = isAfter(new Date(2023, 0, 1));
  expect(messagesOf(rule.execute(new Date(2023, 0, 2)))).toStrictEqual({
    type: "success",
    value: new Date(2023, 0, 2),
  });
  expect(messagesOf(rule.execute(new Date(2022, 11, 31)))).toStrictEqual({
    type: "error",
    value: ["Must be after 2023-01-01."],
  });
});
