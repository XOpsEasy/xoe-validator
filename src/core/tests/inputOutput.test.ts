import { expect, test } from "vitest";
import xoe, { Infer, toFieldErrors } from "../../index.ts";
import { expectedSuccess } from "./helpers.ts";
import { XOEValidationOutput } from "../validatorTypes.ts";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;

const fieldErrors = <T>(result: XOEValidationOutput<T>) =>
  result.type === "error" ? toFieldErrors(result.value) : {};

test("coerce - number", () => {
  const age = xoe.coerce.number().minimum(18);

  expect(age.validate("21")).toStrictEqual(expectedSuccess(21));
  expect(age.validate(21)).toStrictEqual(expectedSuccess(21));
  expect(fieldErrors(age.validate("abc"))).toStrictEqual({
    "": ["Value must be a number."],
  });
  expect(fieldErrors(age.validate("  "))).toStrictEqual({
    "": ["This field is required."],
  });
  expect(fieldErrors(age.validate("12"))).toStrictEqual({
    "": ["Must be greater than or equal to 18."],
  });
  expect(xoe.coerce.number().optional().validate("")).toStrictEqual(
    expectedSuccess(undefined),
  );
});

test("coerce - number accepts plain decimal notation", () => {
  const number = xoe.coerce.number();
  const cases: [string, number][] = [
    ["12", 12],
    [" 12 ", 12],
    ["-3", -3],
    ["+4", 4],
    ["0.5", 0.5],
    [".5", 0.5],
    ["5.", 5],
    ["007", 7],
    ["-0.25", -0.25],
  ];

  for (const [input, expected] of cases) {
    expect(number.validate(input), input).toStrictEqual(
      expectedSuccess(expected),
    );
  }
});

test("coerce - number rejects other notations", () => {
  const number = xoe.coerce.number();

  for (const input of [
    "0x10",
    "0b11",
    "0o17",
    "1e3",
    "1E-2",
    "Infinity",
    "-Infinity",
    "NaN",
    "1_000",
    "1,5",
    "1.2.3",
    "12abc",
    "--1",
    ".",
    "+",
  ]) {
    expect(fieldErrors(number.validate(input)), input).toStrictEqual({
      "": ["Value must be a number."],
    });
  }
});

test("coerce - boolean", () => {
  const flag = xoe.coerce.boolean();

  for (const value of ["true", "1", "on", "yes", " TRUE ", 1, true]) {
    expect(flag.validate(value)).toStrictEqual(expectedSuccess(true));
  }
  for (const value of ["false", "0", "off", "no", 0, false]) {
    expect(flag.validate(value)).toStrictEqual(expectedSuccess(false));
  }
  expect(fieldErrors(flag.validate("maybe"))).toStrictEqual({
    "": ["Value must be true or false."],
  });
});

test("coerce - date", () => {
  const date = xoe.coerce.date().isAfter(new Date("2020-01-01"));

  expect(date.validate("2024-01-01")).toStrictEqual(
    expectedSuccess(new Date("2024-01-01")),
  );
  expect(date.validate(0).type).toStrictEqual("error");
  expect(fieldErrors(date.validate("not a date"))).toStrictEqual({
    "": ["Value must be a valid date."],
  });
});

test("coerce - string", () => {
  expect(xoe.coerce.string().validate(42)).toStrictEqual(expectedSuccess("42"));
  expect(xoe.coerce.string().validate(false)).toStrictEqual(
    expectedSuccess("false"),
  );
});

test("coerce - form data", () => {
  const form = xoe.object({
    name: xoe.string().trim().minLength(2),
    age: xoe.coerce.number().minimum(18),
    newsletter: xoe.coerce.boolean().optional(),
  });

  expect(
    form.validate({ name: "  Jo ", age: "30", newsletter: "on" }),
  ).toStrictEqual(expectedSuccess({ name: "Jo", age: 30, newsletter: true }));
});

test("trim - whitespace only is empty", () => {
  const name = xoe.string().trim().minLength(2);

  expect(fieldErrors(name.validate("   "))).toStrictEqual({
    "": ["This field is required."],
  });
  expect(fieldErrors(name.validate(" a "))).toStrictEqual({
    "": ["Must be at least 2 characters long."],
  });
  expect(name.validate("  ab  ")).toStrictEqual(expectedSuccess("ab"));
});

test("object - unknown keys are removed by default", () => {
  const user = xoe.object({
    name: xoe.string(),
    address: xoe.object({ city: xoe.string() }),
    tags: xoe.array(xoe.object({ label: xoe.string() })),
  });

  expect(
    user.validate({
      name: "john",
      isAdmin: true,
      address: { city: "NY", zip: "1000" },
      tags: [{ label: "a", color: "red" }],
    }),
  ).toStrictEqual(
    expectedSuccess({
      name: "john",
      address: { city: "NY" },
      tags: [{ label: "a" }],
    }),
  );
});

test("object - passthrough keeps unknown keys", () => {
  const user = xoe.object({ name: xoe.string().trim() }).passthrough();

  expect(user.validate({ name: " john ", isAdmin: true })).toStrictEqual(
    expectedSuccess({ name: "john", isAdmin: true }),
  );
});

test("object - missing optional keys are not added", () => {
  const user = xoe.object({
    name: xoe.string(),
    nickname: xoe.string().optional(),
  });

  expect(user.validate({ name: "john" })).toStrictEqual(
    expectedSuccess({ name: "john" }),
  );
});

test("object - validating does not mutate the input", () => {
  const input = { name: " john ", extra: 1 };
  const result = xoe.object({ name: xoe.string().trim() }).validate(input);

  expect(input).toStrictEqual({ name: " john ", extra: 1 });
  expect(result.value).not.toBe(input);
});

test("default - replaces empty values", () => {
  const role = xoe.string().default("user");

  expect(role.validate(undefined)).toStrictEqual(expectedSuccess("user"));
  expect(role.validate("")).toStrictEqual(expectedSuccess("user"));
  expect(role.validate("admin")).toStrictEqual(expectedSuccess("admin"));
});

test("default - the default value is validated", () => {
  expect(
    xoe.number().minimum(10).default(5).validate(undefined).type,
  ).toStrictEqual("error");
});

test("default - a function is called for every validation", () => {
  const tags = xoe.array().default(() => []);
  const first = tags.validate(undefined).value;
  const second = tags.validate(undefined).value;

  expect(first).toStrictEqual([]);
  expect(first).not.toBe(second);
});

test("default - inside an object", () => {
  const settings = xoe.object({
    theme: xoe.string().default("light"),
    pageSize: xoe.coerce.number().default(20),
  });

  expect(settings.validate({})).toStrictEqual(
    expectedSuccess({ theme: "light", pageSize: 20 }),
  );
  expect(settings.validate({ theme: "dark", pageSize: "50" })).toStrictEqual(
    expectedSuccess({ theme: "dark", pageSize: 50 }),
  );
});

test("transform - maps valid values after the rules", () => {
  const email = xoe
    .string()
    .trim()
    .contains("@")
    .transform((value) => value.toLowerCase());

  expect(email.validate(" John@Mail.com ")).toStrictEqual(
    expectedSuccess("john@mail.com"),
  );
  expect(email.validate("nope").type).toStrictEqual("error");
});

test("transform - changes the output type and can be chained", () => {
  const length = xoe
    .string()
    .transform((value) => value.length)
    .transform((n) => n * 2);

  expect(length.validate("abc")).toStrictEqual(expectedSuccess(6));
});

test("transform - is skipped for empty optional values", () => {
  let calls = 0;
  const upper = xoe
    .string()
    .optional()
    .transform((value) => {
      calls++;
      return value.toUpperCase();
    });

  expect(upper.validate(undefined)).toStrictEqual(expectedSuccess(undefined));
  expect(calls).toStrictEqual(0);
});

test("transform - works for objects", async () => {
  const user = xoe
    .object({
      first: xoe.string(),
      last: xoe.string(),
    })
    .transform(({ first, last }) => ({ fullName: `${first} ${last}` }));

  expect(
    await user.validateAsync({ first: "John", last: "Doe", extra: true }),
  ).toStrictEqual(expectedSuccess({ fullName: "John Doe" }));
});

test("types - Infer follows coerce, default and transform", () => {
  const schema = xoe.object({
    age: xoe.coerce.number(),
    role: xoe.string().optional().default("user"),
    nickname: xoe
      .string()
      .optional()
      .transform((value) => value.length),
    tags: xoe.array(xoe.string()).default(() => []),
  });

  const isEqual: Equal<
    Infer<typeof schema>,
    {
      age: number;
      role: string;
      tags: string[];
      nickname?: number | null | undefined;
    }
  > = true;

  expect(isEqual).toStrictEqual(true);
});

test("object - own rules see the parsed output", () => {
  const seen: unknown[] = [];
  const range = xoe
    .object({
      from: xoe.coerce.number(),
      to: xoe.coerce.number(),
    })
    .refine((value) => {
      seen.push(value);
      return value.from < value.to;
    }, "from must be lower than to");

  expect(
    range.validate({ from: "1", to: "5", extra: true }).type,
  ).toStrictEqual("success");
  expect(seen).toStrictEqual([{ from: 1, to: 5 }]);
  expect(fieldErrors(range.validate({ from: "5", to: "1" }))).toStrictEqual({
    "": ["from must be lower than to"],
  });
});

test("object - own rules are skipped when fields are invalid", () => {
  let calls = 0;
  const schema = xoe.object({ a: xoe.number() }).refine(() => {
    calls++;
    return true;
  });

  expect(fieldErrors(schema.validate({ a: "x" }))).toStrictEqual({
    a: ["Value must be a number."],
  });
  expect(calls).toStrictEqual(0);
});

test("object - strict reports unknown keys together with field issues", () => {
  const schema = xoe.object({ name: xoe.string().minLength(3) }).strict();

  expect(
    fieldErrors(schema.validate({ name: "jo", admin: true })),
  ).toStrictEqual({
    "": ["Unknown fields are not allowed. Allowed fields: name."],
    name: ["Must be at least 3 characters long."],
  });
  expect(schema.validate({ name: "john" })).toStrictEqual(
    expectedSuccess({ name: "john" }),
  );
});
