import { expect, test } from "vitest";
import { messagesOf } from "../../../core/tests/helpers.ts";
import { divisibleBy, maximum, minimum } from "../numberRules.ts";

test("minimum rule.execute", () => {
  const rule = minimum(10);
  expect(messagesOf(rule.execute(15))).toStrictEqual({
    type: "success",
    value: 15,
  });
  expect(messagesOf(rule.execute(5))).toStrictEqual({
    type: "error",
    value: ["Must be greater than or equal to 10."],
  });
});

test("minimum rule.execute with custom message", () => {
  const rule = minimum(10, "Custom error message.");
  expect(messagesOf(rule.execute(15))).toStrictEqual({
    type: "success",
    value: 15,
  });
  expect(messagesOf(rule.execute(5))).toStrictEqual({
    type: "error",
    value: ["Custom error message."],
  });
});

test("maximum rule.execute", () => {
  const rule = maximum(100);
  expect(messagesOf(rule.execute(50))).toStrictEqual({
    type: "success",
    value: 50,
  });
  expect(messagesOf(rule.execute(150))).toStrictEqual({
    type: "error",
    value: ["Must be less than or equal to 100."],
  });
});

test("maximum rule.execute with custom message", () => {
  const rule = maximum(100, "Custom error message.");
  expect(messagesOf(rule.execute(50))).toStrictEqual({
    type: "success",
    value: 50,
  });
  expect(messagesOf(rule.execute(150))).toStrictEqual({
    type: "error",
    value: ["Custom error message."],
  });
});

test("divisibleBy rule.execute", () => {
  const rule = divisibleBy(3);
  expect(messagesOf(rule.execute(9))).toStrictEqual({
    type: "success",
    value: 9,
  });
  expect(messagesOf(rule.execute(10))).toStrictEqual({
    type: "error",
    value: ["Must be divisible by 3."],
  });
});

test("divisibleBy rule.execute with custom message", () => {
  const rule = divisibleBy(3, "Custom error message.");
  expect(messagesOf(rule.execute(9))).toStrictEqual({
    type: "success",
    value: 9,
  });
  expect(messagesOf(rule.execute(10))).toStrictEqual({
    type: "error",
    value: ["Custom error message."],
  });
});
