import { expect, test } from "vitest";
import xoe, { toFieldErrors } from "../../../index.ts";
import { messagesOf } from "../../../core/tests/helpers.ts";

test("ArrayValidator - minLength", () => {
  expect(messagesOf(xoe.array().minLength(2).validate([1]))).toStrictEqual({
    type: "error",
    value: ["Must have at least 2 items."],
  });
});

test("ArrayValidator - maxLength", () => {
  expect(xoe.array().maxLength(2).validate([1, 2, 3]).type).toStrictEqual(
    "error",
  );
});

test("ArrayValidator - unique", () => {
  expect(xoe.array().unique().validate([1, 2, 2]).type).toStrictEqual("error");
});

test("ArrayValidator - non-array input does not crash", () => {
  expect(messagesOf(xoe.array().minLength(1).validate("abc"))).toStrictEqual({
    type: "error",
    value: ["Value must be a list."],
  });
});

test("ArrayValidator - item validator reports index paths", () => {
  const result = xoe.array(xoe.number().minimum(1)).validate([1, -3, "x"]);

  expect(result.type === "error" && toFieldErrors(result.value)).toStrictEqual({
    "1": ["Must be greater than or equal to 1."],
    "2": ["Value must be a number."],
  });
});

test("ArrayValidator - array of objects", () => {
  const result = xoe
    .array(xoe.object({ name: xoe.string().minLength(2) }))
    .validate([{ name: "ok" }, { name: "x" }, {}]);

  expect(
    result.type === "error" && result.value.map((issue) => issue.path),
  ).toStrictEqual([
    [1, "name"],
    [2, "name"],
  ]);
});
