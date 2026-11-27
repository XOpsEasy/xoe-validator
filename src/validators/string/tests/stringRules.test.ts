import { expect, test } from "vitest";
import { messagesOf } from "../../../core/tests/helpers.ts";
import { contains, maxLength, minLength, regexMatch } from "../stringRules.ts";

test("minLength rule", () => {
  const rule = minLength(3);
  expect(messagesOf(rule.execute("abc"))).toStrictEqual({
    type: "success",
    value: "abc",
  });
  expect(messagesOf(rule.execute("ab"))).toStrictEqual({
    type: "error",
    value: ["Must be at least 3 characters long."],
  });
});

test("minLength rule with custom message", () => {
  const rule = minLength(3, "Custom message.");
  expect(messagesOf(rule.execute("abc"))).toStrictEqual({
    type: "success",
    value: "abc",
  });
  expect(messagesOf(rule.execute("ab"))).toStrictEqual({
    type: "error",
    value: ["Custom message."],
  });
});

test("maxLength rule", () => {
  const rule = maxLength(5);
  expect(messagesOf(rule.execute("abc"))).toStrictEqual({
    type: "success",
    value: "abc",
  });
  expect(messagesOf(rule.execute("abcdef"))).toStrictEqual({
    type: "error",
    value: ["Must be at most 5 characters long."],
  });
});

test("maxLength rule with custom message", () => {
  const rule = maxLength(5, "Custom message.");
  expect(messagesOf(rule.execute("abc"))).toStrictEqual({
    type: "success",
    value: "abc",
  });
  expect(messagesOf(rule.execute("abcdef"))).toStrictEqual({
    type: "error",
    value: ["Custom message."],
  });
});

test("regexMatch rule", () => {
  const rule = regexMatch(/^[a-z]+$/);
  expect(messagesOf(rule.execute("abc"))).toStrictEqual({
    type: "success",
    value: "abc",
  });
  expect(messagesOf(rule.execute("123"))).toStrictEqual({
    type: "error",
    value: ["Invalid format."],
  });
});

test("regexMatch rule with custom message", () => {
  const rule = regexMatch(/^[a-z]+$/, "Custom message.");
  expect(messagesOf(rule.execute("abc"))).toStrictEqual({
    type: "success",
    value: "abc",
  });
  expect(messagesOf(rule.execute("123"))).toStrictEqual({
    type: "error",
    value: ["Custom message."],
  });
});

test("contains rule", () => {
  const rule = contains("abc");
  expect(messagesOf(rule.execute("abcdef"))).toStrictEqual({
    type: "success",
    value: "abcdef",
  });
  expect(messagesOf(rule.execute("xyz"))).toStrictEqual({
    type: "error",
    value: ['Must contain "abc".'],
  });
});

test("contains rule with custom message", () => {
  const rule = contains("abc", "Custom message.");
  expect(messagesOf(rule.execute("abcdef"))).toStrictEqual({
    type: "success",
    value: "abcdef",
  });
  expect(messagesOf(rule.execute("xyz"))).toStrictEqual({
    type: "error",
    value: ["Custom message."],
  });
});
