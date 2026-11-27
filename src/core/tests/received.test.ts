import { expect, test } from "vitest";
import xoe, { localizeIssues, Validator, XOEIssue } from "../../index.ts";

const issuesOf = (result: { type: string; value: unknown }) =>
  result.type === "error" ? (result.value as readonly XOEIssue[]) : [];

test("received - type issues name the type of the value", () => {
  const received = (
    validator: Validator<unknown, unknown, false>,
    value: unknown,
  ) => issuesOf(validator.validate(value))[0]?.params?.received;

  expect(received(xoe.string(), 42)).toStrictEqual("number");
  expect(received(xoe.number(), "42")).toStrictEqual("string");
  expect(received(xoe.number(), NaN)).toStrictEqual("nan");
  expect(received(xoe.number(), Infinity)).toStrictEqual("infinity");
  expect(received(xoe.date(), new Date("nope"))).toStrictEqual("invalid date");
  expect(received(xoe.date(), "2024-01-01")).toStrictEqual("string");
  expect(received(xoe.string(), new Date(0))).toStrictEqual("date");
  expect(received(xoe.object({}), [1])).toStrictEqual("array");
  expect(received(xoe.array(), {})).toStrictEqual("object");
  expect(received(xoe.boolean(), 1n)).toStrictEqual("bigint");
  expect(
    received(xoe.number(), null),
    "null is empty: a required issue",
  ).toStrictEqual(undefined);
  expect(received(xoe.jsonSchema({ type: "number" }), null)).toStrictEqual(
    "null",
  );

  // literal and enum issues have their own params.
  expect(issuesOf(xoe.literal("a").validate("b"))[0].params).toStrictEqual({
    expected: "a",
  });
});

test("received - can be used in translated messages", () => {
  const issues = issuesOf(
    xoe.object({ age: xoe.number() }).validate({ age: "18" }),
  );
  expect(
    localizeIssues(issues, {
      type: "Očekivan {expected}, dobijen {received}.",
    }).map((issue) => issue.message),
  ).toStrictEqual(["Očekivan number, dobijen string."]);
});

test("reportInput - adds the invalid value at each issue's path", () => {
  const form = xoe.object({
    email: xoe.string().email(),
    age: xoe.coerce.number().minimum(18),
    tags: xoe.array(xoe.string().minLength(2)),
    address: xoe.object({ city: xoe.string() }),
  });
  const input = {
    email: "nope",
    age: "17",
    tags: ["ok", "x"],
    address: {},
  };

  const issues = issuesOf(form.validate(input, { reportInput: true }));
  expect(issues.map(({ path, input }) => ({ path, input }))).toStrictEqual([
    { path: ["email"], input: "nope" },
    // The value as it was passed in, before coerce.
    { path: ["age"], input: "17" },
    { path: ["tags", 1], input: "x" },
    { path: ["address", "city"], input: undefined },
  ]);
  expect("input" in issues[3]).toStrictEqual(true);

  // The root value has the path [].
  expect(
    issuesOf(xoe.string().validate(5, { reportInput: true }))[0].input,
  ).toStrictEqual(5);
});

test("reportInput - off by default, also with validateAsync", async () => {
  const name = xoe
    .string()
    .refineAsync((value) => Promise.resolve(value !== "taken"), "Taken.");

  const plain = issuesOf(await name.validateAsync("taken"));
  expect("input" in plain[0]).toStrictEqual(false);

  const reported = issuesOf(
    await name.validateAsync("taken", { reportInput: true }),
  );
  expect(reported[0].input).toStrictEqual("taken");

  // Successes are unchanged.
  expect(await name.validateAsync("free", { reportInput: true })).toStrictEqual(
    { type: "success", value: "free" },
  );
});

test("reportInput - reads own properties only", () => {
  const input = Object.create({ inherited: "secret" }) as Record<
    string,
    unknown
  >;
  const issues = issuesOf(
    xoe.object({ inherited: xoe.string() }).validate(input, {
      reportInput: true,
    }),
  );
  expect(issues[0].input).toStrictEqual(undefined);
});
