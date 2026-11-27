import { expect, test } from "vitest";
import xoe, {
  Infer,
  toFieldErrors,
  XOEValidationOutput,
} from "../../../index.ts";
import { expectedSuccess } from "../../../core/tests/helpers.ts";

// Untyped expected success, so arrays can be compared with tuple outputs.
const ok = (value: unknown): XOEValidationOutput<unknown> =>
  expectedSuccess(value);

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;

const fieldErrors = <T>(result: XOEValidationOutput<T>) =>
  result.type === "error" ? toFieldErrors(result.value) : {};

const point = xoe.tuple([xoe.number(), xoe.number()]);

test("tuple - validates each position", () => {
  expect(point.validate([1, 2])).toStrictEqual(ok([1, 2]));
  expect(fieldErrors(point.validate([1, "2"]))).toStrictEqual({
    "1": ["Value must be a number."],
  });
  expect(fieldErrors(point.validate([1]))).toStrictEqual({
    "1": ["This field is required."],
  });
  expect(fieldErrors(point.validate("1,2"))).toStrictEqual({
    "": ["Value must be a list."],
  });

  const isEqual: Equal<Infer<typeof point>, [number, number]> = true;
  expect(isEqual).toStrictEqual(true);
});

test("tuple - extra items", () => {
  expect(point.validate([1, 2, 3])).toStrictEqual({
    type: "error",
    value: [
      {
        code: "tuple.length",
        message: "Must have at most 2 items.",
        params: { length: 2 },
        path: [],
      },
    ],
  });
});

test("tuple - optional items at the end may be missing", () => {
  const range = xoe.tuple([xoe.coerce.date(), xoe.coerce.date().optional()]);

  expect(range.validate(["2024-01-01"])).toStrictEqual(
    ok([new Date("2024-01-01")]),
  );
  expect(range.validate(["2024-01-01", "2024-02-01"])).toStrictEqual(
    ok([new Date("2024-01-01"), new Date("2024-02-01")]),
  );

  const isEqual: Equal<
    Infer<typeof range>,
    [Date, Date | null | undefined]
  > = true;
  expect(isEqual).toStrictEqual(true);
});

test("tuple - nested values and async items", async () => {
  const entry = xoe.tuple([
    xoe.string().refineAsync((key) => Promise.resolve(key !== "taken")),
    xoe.object({ value: xoe.number() }),
  ]);

  expect(
    await entry.validateAsync(["key", { value: 1, extra: true }]),
  ).toStrictEqual(ok(["key", { value: 1 }]));
  expect(
    fieldErrors(await entry.validateAsync(["taken", { value: "x" }])),
  ).toStrictEqual({
    "0": ["Validation failed."],
    "1.value": ["Value must be a number."],
  });
});
