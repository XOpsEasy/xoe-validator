import { expect, test } from "vitest";
import xoe from "../../index.ts";
import { expectedError, expectedSuccess } from "./helpers.ts";
import { messagesOf } from "./helpers.ts";

test("chain - issues carry code, message, params and path", () => {
  expect(xoe.string().minLength(3).validate("ab")).toStrictEqual(
    expectedError([
      {
        code: "string.minLength",
        message: "Must be at least 3 characters long.",
        params: { min: 3 },
        path: [],
      },
    ]),
  );
  expect(xoe.string().validate(undefined)).toStrictEqual(
    expectedError([
      {
        code: "required",
        message: "This field is required.",
        path: [],
      },
    ]),
  );
  expect(xoe.string().validate(42)).toStrictEqual(
    expectedError([
      {
        code: "type",
        message: "Value must be text.",
        params: { expected: "string", received: "number" },
        path: [],
      },
    ]),
  );
});

test("chain - validators are immutable", () => {
  const base = xoe.string().minLength(3);
  const short = base.maxLength(5);

  expect(base.validate("abcdefgh")).toStrictEqual(expectedSuccess("abcdefgh"));
  expect(messagesOf(short.validate("abcdefgh"))).toStrictEqual({
    type: "error",
    value: ["Must be at most 5 characters long."],
  });
});

test("chain - collects all issues by default", () => {
  expect(
    messagesOf(xoe.string().minLength(5).contains("@").validate("ab")),
  ).toStrictEqual({
    type: "error",
    value: ["Must be at least 5 characters long.", 'Must contain "@".'],
  });
});

test("chain - abortEarly stops at the first issue", () => {
  expect(
    messagesOf(
      xoe.string().minLength(5).contains("@").abortEarly().validate("ab"),
    ),
  ).toStrictEqual({
    type: "error",
    value: ["Must be at least 5 characters long."],
  });
});

test("chain - empty values are required by default", () => {
  for (const empty of [undefined, null, ""]) {
    expect(messagesOf(xoe.string().minLength(3).validate(empty))).toStrictEqual(
      {
        type: "error",
        value: ["This field is required."],
      },
    );
  }
  expect(
    messagesOf(xoe.number().required("Age is required").validate(null)),
  ).toStrictEqual({
    type: "error",
    value: ["Age is required"],
  });
});

test("chain - optional skips empty values but validates present ones", () => {
  const validator = xoe.string().optional().minLength(3);

  expect(validator.validate(undefined)).toStrictEqual(
    expectedSuccess(undefined),
  );
  expect(validator.validate("abcd")).toStrictEqual(expectedSuccess("abcd"));
  expect(validator.validate("ab").type).toStrictEqual("error");
});

test("chain - wrong type is reported before rules run", () => {
  expect(
    messagesOf(xoe.number().minimum(3).validate(Number.NaN)),
  ).toStrictEqual({
    type: "error",
    value: ["Value must be a number."],
  });
  expect(xoe.number().validate(Infinity).type).toStrictEqual("error");
});

test("chain - errorMessage replaces messages but keeps codes", () => {
  const result = xoe
    .string()
    .minLength(5)
    .contains("@")
    .errorMessage("Invalid email")
    .validate("ab");

  expect(
    result.type === "error" &&
      result.value.map(({ code, message }) => [code, message]),
  ).toStrictEqual([
    ["string.minLength", "Invalid email"],
    ["string.contains", "Invalid email"],
  ]);
});

test("chain - refine with custom code", () => {
  const even = xoe
    .number()
    .refine((value) => value % 2 === 0, "Must be even", "number.even");

  expect(even.validate(4)).toStrictEqual(expectedSuccess(4));
  expect(even.validate(3)).toStrictEqual(
    expectedError([{ code: "number.even", message: "Must be even", path: [] }]),
  );
});

test("chain - refineAsync runs in validateAsync", async () => {
  const taken = ["john", "doe", "alice"];
  const username = xoe
    .string()
    .minLength(3)
    .refineAsync(
      (value) => Promise.resolve(!taken.includes(value)),
      "Username is already taken.",
    );

  expect(username.isAsync).toStrictEqual(true);
  expect(messagesOf(await username.validateAsync("john"))).toStrictEqual({
    type: "error",
    value: ["Username is already taken."],
  });
  expect(await username.validateAsync("smith")).toStrictEqual(
    expectedSuccess("smith"),
  );
});

test("chain - abortEarly skips async rules after a sync failure", async () => {
  let calls = 0;
  const validator = xoe
    .string()
    .minLength(3)
    .refineAsync(() => {
      calls++;
      return Promise.resolve(true);
    })
    .abortEarly();

  await validator.validateAsync("jo");
  expect(calls).toStrictEqual(0);
});

test("chain - validate throws when the validator has async rules", () => {
  const validator = xoe.string().refineAsync(() => Promise.resolve(true));

  // @ts-expect-error validate() is a type error for async validators
  expect(() => validator.validate("abc")).toThrow("validateAsync");
});

test("chain - validateAsync works for sync validators", async () => {
  expect((await xoe.number().minimum(3).validateAsync(1)).type).toStrictEqual(
    "error",
  );
});

test("chain - sameAs compares against the data context", () => {
  const validator = xoe.string().sameAs("password");

  expect(
    validator.validate("secret", { data: { password: "secret" } }).type,
  ).toStrictEqual("success");
  expect(
    validator.validate("other", { data: { password: "secret" } }),
  ).toStrictEqual(
    expectedError([
      {
        code: "sameAs",
        message: "Value must match password.",
        params: { field: "password" },
        path: [],
      },
    ]),
  );
});

test("chain - regexMatch with the global flag is stable", () => {
  const validator = xoe.string().regexMatch(/a/g);

  expect(
    [validator.validate("a"), validator.validate("a")].map((r) => r.type),
  ).toStrictEqual(["success", "success"]);
});

test("chain - boolean isTrue", () => {
  const terms = xoe.boolean().isTrue("You must accept the terms");

  expect(terms.validate(true)).toStrictEqual(expectedSuccess(true));
  expect(messagesOf(terms.validate(false))).toStrictEqual({
    type: "error",
    value: ["You must accept the terms"],
  });
  expect(messagesOf(terms.validate("yes"))).toStrictEqual({
    type: "error",
    value: ["Value must be true or false."],
  });
});
