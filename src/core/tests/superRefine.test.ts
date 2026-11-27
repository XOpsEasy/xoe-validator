import { expect, test } from "vitest";
import xoe, {
  createRule,
  toFieldErrors,
  XOEIssueInput,
  XOEValidationOutput,
} from "../../index.ts";
import { expectedSuccess } from "./helpers.ts";

const fieldErrors = <T>(result: XOEValidationOutput<T>) =>
  result.type === "error" ? toFieldErrors(result.value) : {};

const password = xoe
  .string()
  .minLength(8)
  .superRefine((value) => [
    ...(/\d/.test(value)
      ? []
      : [{ code: "password.digit", message: "Add a digit" }]),
    ...(/[A-Z]/.test(value)
      ? []
      : [{ code: "password.upper", message: "Add an uppercase letter" }]),
  ]);

test("superRefine - reports several issues for one value", () => {
  expect(password.validate("Secret123")).toStrictEqual(
    expectedSuccess("Secret123"),
  );
  expect(password.validate("secretpass")).toStrictEqual({
    type: "error",
    value: [
      { code: "password.digit", message: "Add a digit", path: [] },
      { code: "password.upper", message: "Add an uppercase letter", path: [] },
    ],
  });
});

test("superRefine - runs next to the other rules", () => {
  const result = password.validate("abc");

  expect(
    result.type === "error" && result.value.map((issue) => issue.code),
  ).toStrictEqual(["string.minLength", "password.digit", "password.upper"]);
});

type Shift = { start: number; end: number };

const schedule = xoe
  .object({
    shifts: xoe.array(xoe.object({ start: xoe.number(), end: xoe.number() })),
  })
  .superRefine(({ shifts }) =>
    shifts.flatMap((shift: Shift, index: number): XOEIssueInput[] => {
      const issues: XOEIssueInput[] = [];
      if (shift.end <= shift.start) {
        issues.push({
          code: "shift.order",
          message: "End must be after start",
          path: ["shifts", index, "end"],
        });
      }
      const previous = shifts[index - 1];
      if (previous && shift.start < previous.end) {
        issues.push({
          code: "shift.overlap",
          message: "Overlaps the previous shift",
          path: ["shifts", index, "start"],
          params: { previous: index - 1 },
        });
      }
      return issues;
    }),
  );

test("superRefine - issues on different paths", () => {
  const result = schedule.validate({
    shifts: [
      { start: 8, end: 12 },
      { start: 11, end: 10 },
      { start: 14, end: 18 },
    ],
  });

  expect(fieldErrors(result)).toStrictEqual({
    "shifts.1.end": ["End must be after start"],
    "shifts.1.start": ["Overlaps the previous shift"],
  });
  expect(result.type === "error" && result.value[1].params).toStrictEqual({
    previous: 0,
  });
  expect(
    schedule.validate({ shifts: [{ start: 8, end: 12 }] }).type,
  ).toStrictEqual("success");
});

test("superRefine - nested paths are relative to the validator", () => {
  const week = xoe.object({ monday: schedule });
  const result = week.validate({
    monday: { shifts: [{ start: 9, end: 8 }] },
  });

  expect(fieldErrors(result)).toStrictEqual({
    "monday.shifts.0.end": ["End must be after start"],
  });
});

test("superRefine - default code, empty result and undefined", () => {
  const value = xoe
    .number()
    .superRefine((n) =>
      n < 0 ? [{ message: "Negative" }] : n === 0 ? undefined : [],
    );

  expect(value.validate(1).type).toStrictEqual("success");
  expect(value.validate(0).type).toStrictEqual("success");
  expect(value.validate(-1)).toStrictEqual({
    type: "error",
    value: [{ code: "custom", message: "Negative", path: [] }],
  });
});

test("superRefine - errorMessage replaces messages and keeps codes", () => {
  const result = password.errorMessage("Weak password").validate("secretpass");

  expect(
    result.type === "error" &&
      result.value.map(({ code, message }) => [code, message]),
  ).toStrictEqual([
    ["password.digit", "Weak password"],
    ["password.upper", "Weak password"],
  ]);
});

test("superRefine - abortEarly stops after the first rule with issues", () => {
  let calls = 0;
  const value = xoe
    .string()
    .superRefine(() => [{ message: "a" }, { message: "b" }])
    .superRefine(() => {
      calls++;
      return [{ message: "c" }];
    })
    .abortEarly();

  expect(fieldErrors(value.validate("x"))).toStrictEqual({ "": ["a", "b"] });
  expect(calls).toStrictEqual(0);
});

test("superRefineAsync - waits for sync rules and gets the signal", async () => {
  let calls = 0;
  let signal: AbortSignal | undefined;
  const controller = new AbortController();
  const username = xoe
    .string()
    .minLength(3)
    .superRefineAsync((value, _data, context) => {
      calls++;
      signal = context.signal;
      return Promise.resolve(
        value === "admin"
          ? [{ code: "username.reserved", message: "Reserved name" }]
          : [],
      );
    });

  expect(username.isAsync).toStrictEqual(true);
  expect((await username.validateAsync("ab")).type).toStrictEqual("error");
  expect(calls).toStrictEqual(0);
  expect(
    await username.validateAsync("admin", { signal: controller.signal }),
  ).toStrictEqual({
    type: "error",
    value: [
      {
        code: "username.reserved",
        message: "Reserved name",
        path: [],
      },
    ],
  });
  expect(signal).toStrictEqual(controller.signal);
});

test("createRule - checks may return issue lists", () => {
  const rule = createRule<string>({
    code: "list",
    message: "unused",
    check: (value) =>
      value
        .split(",")
        .map((_part, index) => ({
          message: `Item ${index} is empty`,
          path: [index],
        }))
        .filter((_, index) => value.split(",")[index] === ""),
  });

  expect(rule.execute("a,,b")).toStrictEqual({
    type: "error",
    value: [{ code: "list", message: "Item 1 is empty", path: [1] }],
  });
  expect(
    xoe
      .string()
      .refine(() => true)
      .validate("x").type,
  ).toStrictEqual("success");
});
