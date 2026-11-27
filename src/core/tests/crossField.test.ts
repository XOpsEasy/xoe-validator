import { expect, test } from "vitest";
import xoe, { toFieldErrors, XOEValidationOutput } from "../../index.ts";

const fieldErrors = <T>(result: XOEValidationOutput<T>) =>
  result.type === "error" ? toFieldErrors(result.value) : {};

const booking = xoe
  .object({
    startDate: xoe.coerce.date(),
    endDate: xoe.coerce.date(),
  })
  .refine((value) => value.endDate > value.startDate, {
    message: "End date must be after the start date",
    code: "booking.dateRange",
    path: ["endDate"],
  });

test("refine - reports the issue on a field", () => {
  expect(
    booking.validate({ startDate: "2024-05-10", endDate: "2024-05-01" }),
  ).toStrictEqual({
    type: "error",
    value: [
      {
        code: "booking.dateRange",
        message: "End date must be after the start date",
        path: ["endDate"],
      },
    ],
  });
  expect(
    booking.validate({ startDate: "2024-05-01", endDate: "2024-05-10" }).type,
  ).toStrictEqual("success");
});

test("refine - path is relative to the validator inside a parent", () => {
  const trip = xoe.object({ name: xoe.string(), dates: booking });

  const result = trip.validate({
    name: "Summer",
    dates: { startDate: "2024-05-10", endDate: "2024-05-01" },
  });

  expect(fieldErrors(result)).toStrictEqual({
    "dates.endDate": ["End date must be after the start date"],
  });
});

test("refine - password confirmation compares parsed values", () => {
  const signUp = xoe
    .object({
      password: xoe.string().trim().minLength(6),
      confirmPassword: xoe.string().trim(),
    })
    .refine((value) => value.password === value.confirmPassword, {
      message: "Passwords do not match",
      path: ["confirmPassword"],
    });

  expect(
    signUp.validate({ password: " secret ", confirmPassword: "secret" }).type,
  ).toStrictEqual("success");
  expect(
    fieldErrors(
      signUp.validate({ password: "secret", confirmPassword: "other" }),
    ),
  ).toStrictEqual({ confirmPassword: ["Passwords do not match"] });
});

test("refine - conditionally required field", () => {
  const customer = xoe
    .object({
      isCompany: xoe.coerce.boolean().default(false),
      vatNumber: xoe.string().trim().optional(),
    })
    .refine((value) => !value.isCompany || Boolean(value.vatNumber), {
      message: "VAT number is required for companies",
      code: "required",
      path: ["vatNumber"],
    });

  expect(customer.validate({}).type).toStrictEqual("success");
  expect(
    customer.validate({ isCompany: "on", vatNumber: "RS123" }).type,
  ).toStrictEqual("success");
  expect(customer.validate({ isCompany: "on", vatNumber: "  " })).toStrictEqual(
    {
      type: "error",
      value: [
        {
          code: "required",
          message: "VAT number is required for companies",
          path: ["vatNumber"],
        },
      ],
    },
  );
});

test("refine - path with an array index", () => {
  const tasks = xoe
    .array(xoe.object({ done: xoe.boolean() }))
    .refine((items) => items[0]?.done !== true, {
      message: "First task can't be done",
      path: [0, "done"],
    });

  expect(fieldErrors(tasks.validate([{ done: true }]))).toStrictEqual({
    "0.done": ["First task can't be done"],
  });
});

test("refine - several refinements report on different fields", () => {
  const range = xoe
    .object({ min: xoe.number(), max: xoe.number() })
    .refine((value) => value.min >= 0, { message: "Too low", path: ["min"] })
    .refine((value) => value.max <= 100, {
      message: "Too high",
      path: ["max"],
    });

  expect(fieldErrors(range.validate({ min: -1, max: 200 }))).toStrictEqual({
    min: ["Too low"],
    max: ["Too high"],
  });
});

test("refineAsync - accepts the same options", async () => {
  const taken = ["john@mail.com"];
  const signUp = xoe
    .object({
      email: xoe.string().email(),
      username: xoe.string(),
    })
    .refineAsync((value) => Promise.resolve(!taken.includes(value.email)), {
      message: "Email is taken",
      code: "email.taken",
      path: ["email"],
    });

  expect(
    fieldErrors(
      await signUp.validateAsync({ email: "john@mail.com", username: "j" }),
    ),
  ).toStrictEqual({ email: ["Email is taken"] });
});

test("refine - string message and code arguments still work", () => {
  expect(
    xoe
      .number()
      .refine((n) => n % 2 === 0, "Must be even", "number.even")
      .validate(3),
  ).toStrictEqual({
    type: "error",
    value: [{ code: "number.even", message: "Must be even", path: [] }],
  });
});
