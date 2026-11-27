import { expect, test } from "vitest";
import xoe, {
  Infer,
  InferInput,
  toFieldErrors,
  XOEIssue,
  XOEValidationOutput,
} from "../../index.ts";
import { expectedSuccess } from "./helpers.ts";

// Untyped expected success, so literal and null outputs can be compared.
const ok = (value: unknown): XOEValidationOutput<unknown> =>
  expectedSuccess(value);

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;

const fieldErrors = <T>(result: XOEValidationOutput<T>) =>
  result.type === "error" ? toFieldErrors(result.value) : {};

test("nullable - null is a value, undefined and empty strings are not", () => {
  const middleName = xoe.string().minLength(2).nullable();

  expect(middleName.validate(null)).toStrictEqual(ok(null));
  expect(middleName.validate("Jo")).toStrictEqual(ok("Jo"));
  expect(fieldErrors(middleName.validate("J"))).toStrictEqual({
    "": ["Must be at least 2 characters long."],
  });
  for (const empty of [undefined, ""]) {
    expect(fieldErrors(middleName.validate(empty))).toStrictEqual({
      "": ["This field is required."],
    });
  }
});

test("nullable - types and object keys", () => {
  const user = xoe.object({
    name: xoe.string(),
    deletedAt: xoe.coerce.date().nullable(),
    note: xoe.string().nullable().optional(),
  });

  expect(user.validate({ name: "Jo", deletedAt: null })).toStrictEqual(
    ok({ name: "Jo", deletedAt: null }),
  );
  expect(fieldErrors(user.validate({ name: "Jo" }))).toStrictEqual({
    deletedAt: ["This field is required."],
  });

  const output: Equal<
    Infer<typeof user>,
    { name: string; deletedAt: Date | null; note?: string | null | undefined }
  > = true;
  const input: Equal<
    InferInput<typeof user>,
    {
      name: string;
      deletedAt: Date | string | number | null;
      note?: string | null | undefined;
    }
  > = true;
  expect([output, input]).toStrictEqual([true, true]);
});

test("nullable - with emptyValues undefined (JSON APIs)", () => {
  const body = xoe.object({ parentId: xoe.number().nullable() });
  const options = { emptyValues: "undefined" } as const;

  expect(body.validate({ parentId: null }, options).type).toStrictEqual(
    "success",
  );
  expect(
    fieldErrors(
      xoe
        .object({ parentId: xoe.number() })
        .validate({ parentId: null }, options),
    ),
  ).toStrictEqual({ parentId: ["Value must be a number."] });
});

test("nullable - default replaces null in every order and mode", () => {
  for (const value of [
    xoe.string().nullable().default("x"),
    xoe.string().default("x").nullable(),
  ]) {
    expect(value.validate(null)).toStrictEqual(ok("x"));
    expect(value.validate(null, { emptyValues: "undefined" })).toStrictEqual(
      ok("x"),
    );
    expect(value.validate(undefined)).toStrictEqual(ok("x"));
  }

  const isEqual: Equal<Infer<ReturnType<typeof withDefault>>, string> = true;
  expect(isEqual).toStrictEqual(true);
});

const withDefault = () => xoe.string().nullable().default("x");

test("catch - returns the fallback for invalid values", () => {
  const page = xoe.coerce.number().integer().minimum(1).catch(1);

  expect(page.validate("3")).toStrictEqual(ok(3));
  for (const invalid of ["abc", "-2", "1.5", undefined]) {
    expect(page.validate(invalid), String(invalid)).toStrictEqual(ok(1));
  }
  expect(page.isOptional).toStrictEqual(true);
});

test("catch - a function gets the issues and the input", () => {
  const seen: [string[], unknown][] = [];
  const sort = xoe.enum(["asc", "desc"]).catch((issues: XOEIssue[], input) => {
    seen.push([issues.map((issue) => issue.code), input]);
    return "asc";
  });

  expect(sort.validate("sideways")).toStrictEqual(ok("asc"));
  expect(seen).toStrictEqual([[["enum"], "sideways"]]);
});

test("catch - query params with fallbacks", () => {
  const query = xoe.object({
    page: xoe.coerce.number().integer().minimum(1).catch(1),
    size: xoe.coerce.number().between(1, 100).catch(20),
    sort: xoe.enum(["asc", "desc"]).catch("asc"),
  });

  expect(
    query.validate({ page: "x", size: "500", sort: "random", extra: 1 }),
  ).toStrictEqual(ok({ page: 1, size: 20, sort: "asc" }));

  const isEqual: Equal<
    Infer<typeof query>,
    { page: number; size: number; sort: "asc" | "desc" }
  > = true;
  expect(isEqual).toStrictEqual(true);
});

test("catch - on an object replaces the whole value", () => {
  const settings = xoe.object({ theme: xoe.enum(["light", "dark"]) }).catch({
    theme: "light",
  });

  expect(settings.validate({ theme: "blue" })).toStrictEqual(
    ok({ theme: "light" }),
  );
  expect(settings.validate("nope")).toStrictEqual(ok({ theme: "light" }));
});

test("catch - async validation and rejected checks", async () => {
  const username = xoe
    .string()
    .refineAsync((value) => Promise.resolve(value !== "taken"))
    .catch("guest");

  expect(await username.validateAsync("taken")).toStrictEqual(ok("guest"));
  expect(await username.validateAsync("john")).toStrictEqual(ok("john"));

  // Rejections are not validation issues, so catch doesn't hide them.
  const failing = xoe
    .string()
    .refineAsync(() => Promise.reject(new Error("network")))
    .catch("guest");
  let message = "";
  await failing.validateAsync("x").catch((error: Error) => {
    message = error.message;
  });
  expect(message).toStrictEqual("network");
});
