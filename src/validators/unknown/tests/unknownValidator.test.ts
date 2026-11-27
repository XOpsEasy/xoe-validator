import { expect, test } from "vitest";
import xoe, { Infer, toFieldErrors } from "../../../index.ts";
import { expectedSuccess } from "../../../core/tests/helpers.ts";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;

test("unknown - accepts any present value", () => {
  for (const value of [0, false, "x", {}, [], new Date(0), () => 1]) {
    expect(xoe.unknown().validate(value)).toStrictEqual(expectedSuccess(value));
  }
});

test("unknown - empty values are required unless optional", () => {
  const result = xoe.unknown().validate(undefined);
  expect(result.type === "error" && toFieldErrors(result.value)).toStrictEqual({
    "": ["This field is required."],
  });
  expect(xoe.unknown().optional().validate(null)).toStrictEqual(
    expectedSuccess(null),
  );
});

test("unknown - refine and inferred type", () => {
  const meta = xoe.object({
    payload: xoe
      .unknown()
      .refine(
        (value): value is object => typeof value === "object" && value !== null,
      ),
  });

  expect(meta.validate({ payload: { a: 1 } }).type).toStrictEqual("success");
  expect(meta.validate({ payload: 1 }).type).toStrictEqual("error");

  // The type guard narrows unknown to object.
  const isEqual: Equal<Infer<typeof meta>, { payload: object }> = true;
  expect(isEqual).toStrictEqual(true);
});

test("unknown - optional unknown fields stay required keys in the type", () => {
  const schema = xoe.object({ meta: xoe.unknown().optional() });

  expect(schema.validate({}).type).toStrictEqual("success");
  const isEqual: Equal<Infer<typeof schema>, { meta: unknown }> = true;
  expect(isEqual).toStrictEqual(true);
});
