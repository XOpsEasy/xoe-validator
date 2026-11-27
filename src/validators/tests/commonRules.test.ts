import { expect, test } from "vitest";
import xoe, { XOEValidationOutput } from "../../index.ts";

const codesOf = <T>(result: XOEValidationOutput<T>) =>
  result.type === "error" ? result.value.map((issue) => issue.code) : [];

const assertValid = <T>(
  validator: { validate: (value: unknown) => XOEValidationOutput<T> },
  values: unknown[],
) => {
  for (const value of values) {
    expect(validator.validate(value).type, String(value)).toStrictEqual(
      "success",
    );
  }
};

const assertCode = <T>(
  validator: { validate: (value: unknown) => XOEValidationOutput<T> },
  values: unknown[],
  code: string,
) => {
  for (const value of values) {
    expect(codesOf(validator.validate(value)), String(value)).toStrictEqual([
      code,
    ]);
  }
};

test("string - email", () => {
  const email = xoe.string().email();

  assertValid(email, [
    "john@mail.com",
    "john.doe+tag@sub.mail.co.uk",
    "a@b.io",
  ]);
  assertCode(
    email,
    [
      "john",
      "john@",
      "@mail.com",
      "john@mail",
      "john@.com",
      "john@mail..com",
      "jo hn@mail.com",
      "john@@mail.com",
    ],
    "string.email",
  );
});

test("string - url", () => {
  const url = xoe.string().url();

  assertValid(url, [
    "https://example.com",
    "http://localhost:3000/path?q=1#top",
  ]);
  assertCode(
    url,
    ["example.com", "not a url", "javascript:alert(1)", "ftp://example.com"],
    "string.url",
  );
  assertValid(xoe.string().url(["ftp"]), ["ftp://example.com"]);
});

test("string - uuid", () => {
  const uuid = xoe.string().uuid();

  assertValid(uuid, [
    "123e4567-e89b-12d3-a456-426614174000",
    "550E8400-E29B-41D4-A716-446655440000",
  ]);
  assertCode(
    uuid,
    [
      "123e4567e89b12d3a456426614174000",
      "123e4567-e89b-12d3-a456-42661417400",
      "00000000-0000-0000-0000-000000000000",
      "zzze4567-e89b-12d3-a456-426614174000",
    ],
    "string.uuid",
  );
});

test("string - length, startsWith, endsWith", () => {
  assertValid(xoe.string().length(4), ["abcd"]);
  assertCode(xoe.string().length(4), ["abc", "abcde"], "string.length");

  assertValid(xoe.string().startsWith("RS"), ["RS123"]);
  assertCode(xoe.string().startsWith("RS"), ["XRS1"], "string.startsWith");

  assertValid(xoe.string().endsWith(".pdf"), ["cv.pdf"]);
  assertCode(xoe.string().endsWith(".pdf"), ["cv.pdf.exe"], "string.endsWith");
});

test("string - custom messages and params", () => {
  expect(
    xoe.string().length(4, "PIN must have 4 digits").validate("1"),
  ).toStrictEqual({
    type: "error",
    value: [
      {
        code: "string.length",
        message: "PIN must have 4 digits",
        params: { length: 4 },
        path: [],
        customMessage: true,
      },
    ],
  });
});

test("number - integer, positive, nonNegative, negative", () => {
  assertValid(xoe.number().integer(), [0, 7, -3]);
  assertCode(xoe.number().integer(), [1.5, -0.1], "number.integer");

  assertValid(xoe.number().positive(), [0.1, 5]);
  assertCode(xoe.number().positive(), [0, -1], "number.positive");

  assertValid(xoe.number().nonNegative(), [0, 5]);
  assertCode(xoe.number().nonNegative(), [-0.1], "number.nonNegative");

  assertValid(xoe.number().negative(), [-1]);
  assertCode(xoe.number().negative(), [0, 1], "number.negative");
});

test("number - between is inclusive", () => {
  const rating = xoe.number().between(1, 5);

  assertValid(rating, [1, 3, 5]);
  assertCode(rating, [0, 5.5], "number.between");
});

test("number - rules work with coerce", () => {
  const quantity = xoe.coerce.number().integer().positive();

  expect(quantity.validate("3")).toStrictEqual({ type: "success", value: 3 });
  expect(codesOf(quantity.validate("1.5"))).toStrictEqual(["number.integer"]);
});

test("date - between is inclusive", () => {
  const year2023 = xoe
    .date()
    .between(new Date("2023-01-01"), new Date("2023-12-31"));

  assertValid(year2023, [
    new Date("2023-01-01"),
    new Date("2023-06-15"),
    new Date("2023-12-31"),
  ]);
  assertCode(year2023, [new Date("2022-12-31")], "date.between");
});

test("date - inFuture and inPast use the time of validation", () => {
  const future = xoe.date().inFuture();
  const past = xoe.date().inPast();
  const soon = new Date(Date.now() + 60_000);

  assertValid(future, [soon, new Date("2999-01-01")]);
  assertCode(future, [new Date("2000-01-01")], "date.inFuture");

  assertValid(past, [new Date("2000-01-01")]);
  assertCode(past, [new Date("2999-01-01")], "date.inPast");
});

test("array - nonEmpty", () => {
  assertValid(xoe.array().nonEmpty(), [[1]]);
  assertCode(xoe.array().nonEmpty(), [[]], "array.nonEmpty");
});

test("array - uniqueBy key or selector", () => {
  const users = xoe
    .array(xoe.object({ id: xoe.number(), name: xoe.string() }))
    .uniqueBy("id");

  assertValid(users, [
    [
      { id: 1, name: "a" },
      { id: 2, name: "a" },
    ],
  ]);
  expect(
    users.validate([
      { id: 1, name: "a" },
      { id: 1, name: "b" },
    ]),
  ).toStrictEqual({
    type: "error",
    value: [
      {
        code: "array.uniqueBy",
        message: 'Each item must have a unique "id".',
        params: { key: "id" },
        path: [],
      },
    ],
  });

  const emails = xoe
    .array(xoe.string())
    .uniqueBy((email) => String(email).toLowerCase());
  assertCode(emails, [["a@x.io", "A@x.io"]], "array.uniqueBy");
});
