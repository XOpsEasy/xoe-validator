import { expect, test } from "vitest";
import xoe, {
  createRule,
  defineValidator,
  Infer,
  XOEValidationOutput,
} from "../../index.ts";
import { expectedSuccess } from "./helpers.ts";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;

const messagesOf = <T>(result: XOEValidationOutput<T>) =>
  result.type === "error" ? result.value.map((issue) => issue.message) : [];

const slug = (message?: string) =>
  createRule<string>({
    code: "string.slug",
    check: (value) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value),
    message: message ?? "Value must be a slug.",
  });

test("extend - adds rules to a validator type", () => {
  const string = xoe.string.extend({ slug });
  const validator = string().trim().minLength(3).slug();

  expect(validator.validate(" my-post ")).toStrictEqual(
    expectedSuccess("my-post"),
  );
  expect(validator.validate("My Post")).toStrictEqual({
    type: "error",
    value: [
      {
        code: "string.slug",
        message: "Value must be a slug.",
        path: [],
      },
    ],
  });
});

test("extend - does not change the original factory", () => {
  xoe.string.extend({ slug });

  expect("slug" in xoe.string()).toStrictEqual(false);
});

test("extend - can be chained and supports coerce", () => {
  const even = (message?: string) =>
    createRule<number>({
      code: "number.even",
      check: (value) => value % 2 === 0,
      message: message ?? "Number must be even.",
    });
  const number = xoe.number.extend({ even }).extend({
    multipleOfTen: () =>
      createRule<number>({
        code: "number.multipleOfTen",
        check: (value) => value % 10 === 0,
        message: "Number must be a multiple of 10.",
      }),
  });

  expect(
    number({ coerce: true }).even().multipleOfTen().validate("20"),
  ).toStrictEqual(expectedSuccess(20));
  expect(messagesOf(number().even().multipleOfTen().validate(4))).toStrictEqual(
    ["Number must be a multiple of 10."],
  );
});

test("extend - can replace a built-in rule", () => {
  const string = xoe.string.extend({
    minLength: (min: number) =>
      createRule<string>({
        code: "string.minLength",
        params: { min },
        check: (value) => value.length >= min,
        message: `Najmanje ${min} karaktera.`,
      }),
  });

  expect(messagesOf(string().minLength(3).validate("ab"))).toStrictEqual([
    "Najmanje 3 karaktera.",
  ]);
});

test("extend - rejects names of built-in methods", () => {
  expect(() =>
    xoe.string.extend({
      optional: () =>
        createRule<string>({ code: "x", check: () => true, message: "" }),
    }),
  ).toThrow('rule "optional"');
});

test("defineValidator - a new validator type", () => {
  const maxDigits = (max: number, message?: string) =>
    createRule<bigint>({
      code: "bigint.maxDigits",
      params: { max },
      check: (value) => value.toString().length <= max,
      message: message ?? `At most ${max} digits.`,
    });

  const bigint = defineValidator({
    type: "bigint",
    check: (value): value is bigint => typeof value === "bigint",
    message: "Value must be a bigint.",
    rules: { maxDigits },
    coerce: (value) => (typeof value === "string" ? BigInt(value) : value),
  });

  const id = bigint({ coerce: true }).maxDigits(3);
  expect(id.validate("123")).toStrictEqual(expectedSuccess(123n));
  expect(messagesOf(id.validate("1234"))).toStrictEqual(["At most 3 digits."]);
  expect(messagesOf(bigint().validate(1))).toStrictEqual([
    "Value must be a bigint.",
  ]);

  const order = xoe.object({ id: bigint().optional() });
  const isEqual: Equal<
    Infer<typeof order>,
    { id?: bigint | null | undefined }
  > = true;
  expect(isEqual).toStrictEqual(true);
});
