import { expect, test } from "vitest";
import xoe, {
  createRule,
  Infer,
  InferInput,
  numberRules,
  stringRules,
  toFieldErrors,
  XOEValidationOutput,
} from "../../index.ts";
import { expectedSuccess } from "./helpers.ts";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;

const fieldErrors = <T>(result: XOEValidationOutput<T>) =>
  result.type === "error" ? toFieldErrors(result.value) : {};

test("readonly - issues and paths can't be changed through the types", () => {
  const result = xoe.object({ a: xoe.string() }).validate({});
  if (result.type !== "error") throw new Error("expected an error");

  // Only type-checked, never run.
  const typeChecks = () => {
    // @ts-expect-error issues are readonly
    result.value.push(result.value[0]);
    // @ts-expect-error paths are readonly
    result.value[0].path.push("x");
    // @ts-expect-error messages are readonly
    result.value[0].message = "changed";
    // @ts-expect-error field errors are readonly
    toFieldErrors(result.value).a.push("x");
  };

  expect(typeof typeChecks).toStrictEqual("function");
  expect(toFieldErrors(result.value)).toStrictEqual({
    a: ["This field is required."],
  });
});

const passwordRules = [
  stringRules.minLength(8),
  stringRules.regexMatch(/\d/, "Add a digit"),
  stringRules.regexMatch(/[A-Z]/, "Add an uppercase letter"),
];

test("with - applies a shared list of rules", () => {
  const password = xoe.string().with(...passwordRules);
  const adminPassword = xoe
    .string()
    .with(...passwordRules)
    .minLength(12);

  expect(password.validate("Secret123").type).toStrictEqual("success");
  expect(fieldErrors(password.validate("secret"))).toStrictEqual({
    "": [
      "Must be at least 8 characters long.",
      "Add a digit",
      "Add an uppercase letter",
    ],
  });
  expect(fieldErrors(adminPassword.validate("Secret123"))).toStrictEqual({
    "": ["Must be at least 12 characters long."],
  });
});

test("with - custom rules and type checking", () => {
  const even = createRule<number>({
    code: "number.even",
    message: "Must be even",
    check: (n) => n % 2 === 0,
  });
  const value = xoe.number().with(numberRules.positive(), even);

  expect(value.validate(4).type).toStrictEqual("success");
  expect(fieldErrors(value.validate(-3))).toStrictEqual({
    "": ["Must be greater than 0.", "Must be even"],
  });

  // @ts-expect-error string rules don't fit a number validator
  xoe.number().with(stringRules.minLength(2));
});

test("pipe - validates the output with the next validator", () => {
  const settings = xoe
    .string()
    .transform((text) => JSON.parse(text) as unknown)
    .pipe(xoe.object({ theme: xoe.enum(["light", "dark"]) }));

  expect(settings.validate('{"theme":"dark","x":1}')).toStrictEqual({
    type: "success",
    value: { theme: "dark" },
  });
  expect(fieldErrors(settings.validate('{"theme":"blue"}'))).toStrictEqual({
    theme: ['Value must be one of: "light", "dark".'],
  });
  expect(fieldErrors(settings.validate(42))).toStrictEqual({
    "": ["Value must be text."],
  });

  const isEqual: Equal<
    Infer<typeof settings>,
    { theme: "light" | "dark" }
  > = true;
  const input: Equal<InferInput<typeof settings>, string> = true;
  expect([isEqual, input]).toStrictEqual([true, true]);
});

test("pipe - chains several validators", () => {
  const percent = xoe
    .string()
    .trim()
    .pipe(xoe.coerce.number())
    .pipe(xoe.number().between(0, 100));

  expect(percent.validate(" 42 ")).toStrictEqual(expectedSuccess(42));
  expect(fieldErrors(percent.validate("120"))).toStrictEqual({
    "": ["Must be between 0 and 100."],
  });
  expect(fieldErrors(percent.validate("abc"))).toStrictEqual({
    "": ["Value must be a number."],
  });
});

test("pipe - the next validator must accept the output", () => {
  // @ts-expect-error a number output doesn't fit a string validator
  xoe.number().pipe(xoe.string());
  // A wider input is fine: coerce.number accepts string | number.
  expect(xoe.string().pipe(xoe.coerce.number()).validate("5")).toStrictEqual(
    expectedSuccess(5),
  );
});

test("pipe - optional empty values skip the next validator", () => {
  const age = xoe.string().optional().pipe(xoe.coerce.number().minimum(18));

  expect(age.validate(undefined)).toStrictEqual(expectedSuccess(undefined));
  expect(age.validate("21")).toStrictEqual(expectedSuccess(21));
  expect(age.validate("12").type).toStrictEqual("error");

  const isEqual: Equal<Infer<typeof age>, number | null | undefined> = true;
  expect(isEqual).toStrictEqual(true);
});

test("pipe - inside objects, with paths and async validators", async () => {
  const form = xoe.object({
    payload: xoe
      .string()
      .transform((text) => JSON.parse(text) as unknown)
      .pipe(
        xoe.object({
          username: xoe
            .string()
            .refineAsync(
              (name) => Promise.resolve(name !== "taken"),
              "Username is taken",
            ),
        }),
      ),
  });

  expect(form.isAsync).toStrictEqual(true);
  expect(
    fieldErrors(await form.validateAsync({ payload: '{"username":"taken"}' })),
  ).toStrictEqual({ "payload.username": ["Username is taken"] });
  expect(
    await form.validateAsync({ payload: '{"username":"john"}' }),
  ).toStrictEqual({
    type: "success",
    value: { payload: { username: "john" } },
  });
});
