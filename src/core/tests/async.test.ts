import { expect, test } from "vitest";
import xoe, { Infer, toFieldErrors, XOEValidationOutput } from "../../index.ts";
import { expectedSuccess } from "./helpers.ts";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;

const fieldErrors = <T>(result: XOEValidationOutput<T>) =>
  result.type === "error" ? toFieldErrors(result.value) : {};

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

test("async rules - skipped when the other rules of the value fail", async () => {
  const calls: string[] = [];
  const email = xoe
    .string()
    .email()
    .refineAsync((value) => {
      calls.push(value);
      return Promise.resolve(true);
    }, "Email is taken");

  expect(fieldErrors(await email.validateAsync("not-an-email"))).toStrictEqual({
    "": ["Invalid email address."],
  });
  expect(calls).toStrictEqual([]);

  expect(await email.validateAsync("john@mail.com")).toStrictEqual(
    expectedSuccess("john@mail.com"),
  );
  expect(calls).toStrictEqual(["john@mail.com"]);
});

test("async rules - run after sync rules regardless of the chain order", async () => {
  const calls: string[] = [];
  const username = xoe
    .string()
    .refineAsync((value) => {
      calls.push(value);
      return Promise.resolve(false);
    }, "taken")
    .minLength(3);

  expect(fieldErrors(await username.validateAsync("jo"))).toStrictEqual({
    "": ["Must be at least 3 characters long."],
  });
  expect(calls).toStrictEqual([]);
  expect(fieldErrors(await username.validateAsync("john"))).toStrictEqual({
    "": ["taken"],
  });
});

test("async rules - only the invalid field skips its API call", async () => {
  const calls: string[] = [];
  const check = (field: string) => () => {
    calls.push(field);
    return Promise.resolve(true);
  };
  const signUp = xoe.object({
    email: xoe.string().email().refineAsync(check("email")),
    username: xoe.string().minLength(3).refineAsync(check("username")),
  });

  await signUp.validateAsync({ email: "nope", username: "john" });
  expect(calls).toStrictEqual(["username"]);
});

test("async rules - abortEarly still stops at the first issue", async () => {
  let calls = 0;
  const value = xoe
    .string()
    .refineAsync(() => {
      calls++;
      return Promise.resolve(false);
    }, "first")
    .refineAsync(() => {
      calls++;
      return Promise.resolve(false);
    }, "second")
    .abortEarly();

  expect(fieldErrors(await value.validateAsync("x"))).toStrictEqual({
    "": ["first"],
  });
  expect(calls).toStrictEqual(1);
});

test("async transform - awaited by validateAsync", async () => {
  const slug = xoe
    .string()
    .trim()
    .transform(async (value) => {
      await tick();
      return value.toLowerCase();
    })
    .transform((value) => value.replaceAll(" ", "-"));

  expect(await slug.validateAsync(" My Post ")).toStrictEqual(
    expectedSuccess("my-post"),
  );

  const isEqual: Equal<Infer<typeof slug>, string> = true;
  expect(isEqual).toStrictEqual(true);
});

test("async transform - validate throws instead of returning a promise", () => {
  const upper = xoe
    .string()
    .transform((value) => Promise.resolve(value.toUpperCase()));

  // @ts-expect-error validate() is a type error for async validators
  expect(() => upper.validate("ab")).toThrow("validateAsync");
});

test("async default - awaited by validateAsync, validate throws", async () => {
  const createdAt = xoe
    .date()
    .default((() =>
      Promise.resolve(new Date("2024-01-01"))) as unknown as () => Date);

  expect(await createdAt.validateAsync(undefined)).toStrictEqual(
    expectedSuccess(new Date("2024-01-01")),
  );
  expect(() => createdAt.validate(undefined)).toThrow("validateAsync");
});

test("sync validate - rejected promises are not left unhandled", async () => {
  const failingCheck = xoe
    .string()
    .refine((() =>
      Promise.reject(new Error("network"))) as unknown as () => boolean);
  const failingTransform = xoe
    .string()
    .transform(() => Promise.reject(new Error("network")));

  expect(() => failingCheck.validate("x")).toThrow("validateAsync");
  // @ts-expect-error validate() is a type error for async validators
  expect(() => failingTransform.validate("x")).toThrow("validateAsync");
  // An unhandled rejection would fail this test.
  await tick();
});
