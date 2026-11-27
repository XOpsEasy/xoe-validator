// Regression tests for the blockers the November 2026 code review found.
import { expect, test } from "vitest";
import xoe, {
  defineValidator,
  Infer,
  toJsonSchema,
  XOEValidationOutput,
} from "../../index.ts";
import { expectedSuccess } from "./helpers.ts";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;

const codes = <T>(result: XOEValidationOutput<T>) =>
  result.type === "error"
    ? result.value.map((issue) => `${issue.path.join(".")}:${issue.code}`)
    : [];

test("B1 - ~standard.validate returns a promise for an async transform", async () => {
  const slug = xoe
    .string()
    .transform((text) => Promise.resolve(text.toLowerCase()));
  const pending = slug["~standard"].validate("ABC");

  expect(pending instanceof Promise).toStrictEqual(true);
  expect(await pending).toStrictEqual({ value: "abc" });
  expect(
    await xoe.object({ slug })["~standard"].validate({ slug: "ABC" }),
  ).toStrictEqual({ value: { slug: "abc" } });
  // Invalid input never reaches the transform; the issues come back as usual.
  expect(
    (await slug["~standard"].validate(1)).issues?.map((issue) => issue.path),
  ).toStrictEqual([[]]);
});

test("B1 - ~standard.validate waits for async defaults and catch", async () => {
  // The typed signatures take sync functions; at runtime async ones work.
  const asyncDefault = xoe
    .string()
    .default((() => Promise.resolve("fallback")) as unknown as () => string);
  const asyncCatch = xoe
    .number()
    .catch((() => Promise.resolve(0)) as unknown as () => number);

  expect(await asyncDefault["~standard"].validate(undefined)).toStrictEqual({
    value: "fallback",
  });
  expect(await asyncCatch["~standard"].validate("x")).toStrictEqual({
    value: 0,
  });
});

test("B1 - sync validators still answer ~standard synchronously", () => {
  expect(xoe.string()["~standard"].validate("a")).toStrictEqual({ value: "a" });
  expect(
    xoe.object({ a: xoe.number() })["~standard"].validate({ a: 1 }),
  ).toStrictEqual({ value: { a: 1 } });
});

test("B2 - a transform that throws reports a transform issue", async () => {
  const settings = xoe
    .string()
    .transform((text) => JSON.parse(text) as unknown);

  expect(codes(settings.validate("not json"))).toStrictEqual([":transform"]);
  expect(settings.validate('{"a":1}')).toStrictEqual(expectedSuccess({ a: 1 }));
  expect(codes(await settings.validateAsync("not json"))).toStrictEqual([
    ":transform",
  ]);
  expect(settings["~standard"].validate("not json")).toStrictEqual({
    issues: [
      {
        code: "transform",
        message: "Invalid value.",
        path: [],
      },
    ],
  });
  // Nested: the issue has the field's path.
  expect(
    codes(xoe.object({ settings }).validate({ settings: "{" })),
  ).toStrictEqual(["settings:transform"]);
});

test("B2 - errorMessage and catch apply to a throwing transform", () => {
  const parsed = xoe.string().transform((text) => JSON.parse(text) as number);

  expect(parsed.validate("x").type).toStrictEqual("error");
  expect(
    xoe
      .string()
      .errorMessage("Bad JSON")
      .transform((text) => JSON.parse(text) as number)
      .validate("x"),
  ).toStrictEqual({
    type: "error",
    value: [
      {
        code: "transform",
        message: "Bad JSON",
        path: [],
        customMessage: true,
      },
    ],
  });
});

test("B2 - a coerce function that throws leaves the value to the type check", () => {
  const bigint = defineValidator({
    type: "bigint",
    check: (value): value is bigint => typeof value === "bigint",
    coerce: (value: string | bigint) =>
      typeof value === "string" ? BigInt(value) : value,
  });

  expect(codes(bigint({ coerce: true }).validate("abc"))).toStrictEqual([
    ":type",
  ]);
  expect(bigint({ coerce: true }).validate("12")).toStrictEqual(
    expectedSuccess(12n),
  );
});

test("B3 - an empty optional value skips transform and pipe as undefined", () => {
  const tags = xoe
    .string()
    .optional()
    .transform((text) => text.split(","));
  const age = xoe.string().optional().pipe(xoe.coerce.number());
  const trimmed = xoe.string().trim().optional().pipe(xoe.coerce.number());

  expect(tags.validate("")).toStrictEqual(expectedSuccess(undefined));
  expect(age.validate("")).toStrictEqual(expectedSuccess(undefined));
  expect(trimmed.validate("   ")).toStrictEqual(expectedSuccess(undefined));
  expect(tags.validate(null)).toStrictEqual(expectedSuccess(null));
  expect(tags.validate("a,b")).toStrictEqual(expectedSuccess(["a", "b"]));
  expect(xoe.object({ tags }).validate({ tags: "" })).toStrictEqual(
    expectedSuccess({ tags: undefined }),
  );

  const typeChecks: [
    Equal<Infer<typeof tags>, string[] | null | undefined>,
    Equal<Infer<typeof age>, number | null | undefined>,
  ] = [true, true];
  expect(typeChecks).toStrictEqual([true, true]);
});

test("B3 - an optional string without transform still keeps an empty string", () => {
  expect(xoe.string().optional().validate("")).toStrictEqual(
    expectedSuccess(""),
  );
  expect(xoe.number().optional().validate("")).toStrictEqual(
    expectedSuccess(undefined),
  );
});

test("B4 - jsonSchema multipleOf accepts decimal multiples", () => {
  const money = xoe.jsonSchema({ type: "number", multipleOf: 0.01 });

  for (const amount of [0, 1, 10, 0.5, 2.5, 19.99, 0.29, 0.07, 4.35, 1234.56]) {
    expect(money.validate(amount).type, String(amount)).toStrictEqual(
      "success",
    );
  }
  for (const amount of [0.001, 1.005, 19.999]) {
    expect(money.validate(amount).type, String(amount)).toStrictEqual("error");
  }
});

test("B4 - jsonSchema multipleOf matches the JSON-Schema-Test-Suite", () => {
  const small = xoe.jsonSchema({ type: "number", multipleOf: 0.0001 });
  expect(small.validate(0.0075).type).toStrictEqual("success");
  expect(small.validate(0.00751).type).toStrictEqual("error");
  expect(
    xoe.jsonSchema({ type: "integer", multipleOf: 1e-8 }).validate(12391239123)
      .type,
  ).toStrictEqual("success");
  expect(
    xoe.jsonSchema({ type: "number", multipleOf: 0.123456789 }).validate(1e308)
      .type,
  ).toStrictEqual("error");
  expect(
    xoe.jsonSchema({ type: "number", multipleOf: 1.5 }).validate(35).type,
  ).toStrictEqual("error");
});

test("B4 - maxDecimals survives a round trip through toJsonSchema", () => {
  const amount = xoe.jsonSchema(toJsonSchema(xoe.number().maxDecimals(2)));

  for (const value of [1, 100, 19.99, 0.29]) {
    expect(amount.validate(value).type, String(value)).toStrictEqual("success");
  }
  expect(amount.validate(1.234).type).toStrictEqual("error");
});
