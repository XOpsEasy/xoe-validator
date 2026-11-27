import { expect, test } from "vitest";
import xoe, { Infer, toFieldErrors } from "../../../index.ts";
import { XOEValidationOutput } from "../../../core/validatorTypes.ts";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;

const fieldErrors = <T>(result: XOEValidationOutput<T>) =>
  result.type === "error" ? toFieldErrors(result.value) : {};

const userSchema = xoe.object({
  name: xoe.string().minLength(3).maxLength(50),
  surname: xoe.string().optional().minLength(3).maxLength(50),
  username: xoe.string().minLength(3).maxLength(15),
  age: xoe.number().minimum(18).maximum(99),
});

test("object - infers the output type", () => {
  const isEqual: Equal<
    Infer<typeof userSchema>,
    {
      name: string;
      username: string;
      age: number;
      surname?: string | null | undefined;
    }
  > = true;

  expect(isEqual).toStrictEqual(true);
});

test("object - valid data with an optional field missing", () => {
  const data = { name: "john", username: "doe", age: 22 };

  expect(userSchema.validate(data)).toStrictEqual({
    type: "success",
    value: data,
  });
});

test("object - issues have field paths", () => {
  const result = userSchema.validate({
    name: "john",
    surname: "do",
    username: "doe",
    age: 22,
  });

  expect(result).toStrictEqual({
    type: "error",
    value: [
      {
        code: "string.minLength",
        message: "Must be at least 3 characters long.",
        params: { min: 3 },
        path: ["surname"],
      },
    ],
  });
});

test("object - required fields", () => {
  const result = userSchema.validate({
    name: "",
    surname: "",
    username: "",
    age: undefined,
  });

  expect(fieldErrors(result)).toStrictEqual({
    name: ["This field is required."],
    username: ["This field is required."],
    age: ["This field is required."],
  });
});

test("object - toFieldErrors keeps all messages per field", () => {
  const schema = xoe.object({
    email: xoe.string().minLength(6).contains("@"),
  });

  expect(fieldErrors(schema.validate({ email: "ab" }))).toStrictEqual({
    email: ["Must be at least 6 characters long.", 'Must contain "@".'],
  });
});

test("object - abortEarly stops at the first invalid field", () => {
  expect(fieldErrors(userSchema.abortEarly().validate({}))).toStrictEqual({
    name: ["This field is required."],
  });
});

test("object - requireOne", () => {
  const schema = xoe
    .object({
      name: xoe.string().minLength(3).optional(),
      username: xoe.string().minLength(3).optional(),
      age: xoe.number().minimum(18).optional(),
    })
    .requireOne("You need to add at least one value");

  const result = schema.validate({ name: null, username: "", age: undefined });

  expect(result).toStrictEqual({
    type: "error",
    value: [
      {
        code: "object.requireOne",
        message: "You need to add at least one value",
        params: { keys: ["name", "username", "age"] },
        path: [],
        customMessage: true,
      },
    ],
  });
  expect(fieldErrors(result)).toStrictEqual({
    "": ["You need to add at least one value"],
  });
  expect(schema.validate({ age: 20 }).type).toStrictEqual("success");
});

test("object - strict rejects unknown keys", () => {
  const schema = xoe.object({ name: xoe.string() }).strict();

  expect(
    fieldErrors(schema.validate({ name: "john", admin: true })),
  ).toStrictEqual({
    "": ["Unknown fields are not allowed. Allowed fields: name."],
  });
});

test("object - non-object input", () => {
  expect(fieldErrors(userSchema.validate("nope"))).toStrictEqual({
    "": ["Value must be an object."],
  });
});

test("object - sameAs for password confirmation", () => {
  const schema = xoe.object({
    password: xoe.string(),
    confirmPassword: xoe.string().sameAs("password", "Passwords do not match"),
  });

  expect(
    schema.validate({ password: "secret", confirmPassword: "secret" }).type,
  ).toStrictEqual("success");
  expect(
    fieldErrors(
      schema.validate({ password: "secret", confirmPassword: "secret1" }),
    ),
  ).toStrictEqual({ confirmPassword: ["Passwords do not match"] });
});

test("object - sameAs for objects and dates", () => {
  const schema = xoe.object({
    address: xoe.object(),
    confirmAddress: xoe.object().sameAs("address"),
    startDate: xoe.date(),
    endDate: xoe.date().sameAs("startDate"),
  });
  const address = { street: "Main St", city: "New York" };

  expect(
    schema.validate({
      address,
      confirmAddress: { ...address },
      startDate: new Date("2023-01-01"),
      endDate: new Date("2023-01-01"),
    }).type,
  ).toStrictEqual("success");
  expect(
    fieldErrors(
      schema.validate({
        address,
        confirmAddress: { street: "Second St", city: "Los Angeles" },
        startDate: new Date("2023-01-01"),
        endDate: new Date("2023-01-02"),
      }),
    ),
  ).toStrictEqual({
    confirmAddress: ["Value must match address."],
    endDate: ["Value must match startDate."],
  });
});

test("object - nested objects", () => {
  const schema = xoe.object({
    user: xoe.object({
      email: xoe.string().contains("@"),
      address: xoe.object({ city: xoe.string().minLength(2) }),
    }),
  });

  const result = schema.validate({
    user: { email: "nope", address: { city: "X" } },
  });

  expect(
    result.type === "error" && result.value.map((issue) => issue.path),
  ).toStrictEqual([
    ["user", "email"],
    ["user", "address", "city"],
  ]);
  expect(fieldErrors(schema.validate({}))).toStrictEqual({
    user: ["This field is required."],
  });
});

test("object - async field rules", async () => {
  const taken = ["john", "alice", "admin"];
  const schema = xoe.object({
    name: xoe
      .string()
      .minLength(3)
      .regexMatch(/^[a-zA-Z]+$/)
      .errorMessage("Single message for all rules"),
    username: xoe
      .string()
      .minLength(3)
      .maxLength(20)
      .refineAsync(
        (username) => Promise.resolve(!taken.includes(username)),
        "Username is already taken.",
      ),
    age: xoe.number().minimum(18).maximum(99),
  });

  expect(schema.isAsync).toStrictEqual(true);
  expect(
    fieldErrors(
      await schema.validateAsync({ name: "J1", username: "john", age: 17 }),
    ),
  ).toStrictEqual({
    name: ["Single message for all rules"],
    username: ["Username is already taken."],
    age: ["Must be greater than or equal to 18."],
  });
  expect(
    (
      await schema.validateAsync({
        name: "Jane",
        username: "unique_user",
        age: 25,
      })
    ).type,
  ).toStrictEqual("success");
});

test("object schema - errorMessage also replaces the strict message", () => {
  const schema = xoe
    .object({ name: xoe.string() })
    .strict()
    .errorMessage("Invalid user");

  const result = schema.validate({ name: "john", admin: true });
  expect(
    result.type === "error" &&
      result.value.map(({ code, message }) => [code, message]),
  ).toStrictEqual([["object.strict", "Invalid user"]]);
});
