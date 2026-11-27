import { expect, test } from "vitest";
import xoe, { createRule, Validator, XOEUsageError } from "../../index.ts";

const usageError = (fn: () => unknown): XOEUsageError => {
  try {
    fn();
  } catch (error) {
    expect(error instanceof XOEUsageError).toStrictEqual(true);
    expect(error instanceof Error).toStrictEqual(true);
    expect((error as Error).name).toStrictEqual("XOEUsageError");
    return error as XOEUsageError;
  }
  throw new Error("expected an XOEUsageError");
};

test("XOEUsageError - validate with async rules", () => {
  const validator = xoe.string().refineAsync(() => Promise.resolve(true));
  const error = usageError(() =>
    // @ts-expect-error validate() is a type error for async validators
    validator.validate("x"),
  );

  expect(error.code).toStrictEqual("ASYNC_IN_SYNC");
});

test("XOEUsageError - rule names that clash with built-in methods", () => {
  const error = usageError(() =>
    xoe.string.extend({
      refine: () =>
        createRule<string>({ code: "x", check: () => true, message: "" }),
    }),
  );

  expect(error.code).toStrictEqual("NAME_CONFLICT");
});

test("XOEUsageError - invalid data never throws", () => {
  expect(xoe.object({ a: xoe.number() }).validate("nope").type).toStrictEqual(
    "error",
  );
});

test("isOptional - true when the input may be empty", () => {
  expect(xoe.string().isOptional).toStrictEqual(false);
  expect(xoe.string().optional().isOptional).toStrictEqual(true);
  expect(xoe.string().default("x").isOptional).toStrictEqual(true);
  expect(xoe.string().optional().required().isOptional).toStrictEqual(false);

  const user = xoe.object({
    name: xoe.string(),
    nickname: xoe.string().optional(),
  });
  expect(
    Object.entries(user.shape).map(([key, field]) => [key, field.isOptional]),
  ).toStrictEqual([
    ["name", false],
    ["nickname", true],
  ]);
  expect(
    Object.values(user.partial().shape).map((field) => field.isOptional),
  ).toStrictEqual([true, true]);

  type Node = { children: Node[] };
  const node: Validator<Node> = xoe.object({
    children: xoe.array(xoe.lazy(() => node)),
  });
  expect(xoe.lazy(() => node).isOptional).toStrictEqual(false);
});
