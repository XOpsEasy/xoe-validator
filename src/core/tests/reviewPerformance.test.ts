// Regression tests for the November 2026 code review findings on large inputs
// and performance (V14-V18). The time limits are generous: the fixed code needs a few milliseconds, the old one seconds.
import { expect, test } from "vitest";
import xoe, {
  JsonSchemaDefinition,
  toFieldErrors,
  toJsonSchema,
  Validator,
} from "../../index.ts";
import { createLimit } from "../limit.ts";

const timed = <T>(fn: () => T): [T, number] => {
  const start = performance.now();
  const value = fn();
  return [value, performance.now() - start];
};

test("V14 - more than 130000 issues are returned, not thrown", async () => {
  const body = { rows: Array(130_000).fill("x") };
  const rows = xoe.object({ rows: xoe.array(xoe.number()) });

  const result = rows.validate(body);
  expect(result.type === "error" && result.value.length).toStrictEqual(130_000);
  const async = await rows.validateAsync(body);
  expect(async.type === "error" && async.value.length).toStrictEqual(130_000);

  const many = xoe
    .array(xoe.number())
    .superRefine((items) =>
      items.map((_, index) => ({ message: "dup", path: [index] })),
    )
    .validate(Array(130_000).fill(1));
  expect(many.type === "error" && many.value.length).toStrictEqual(130_000);
});

test("V15 - isAsync of interlinked lazy validators takes linear time", () => {
  const shape: Record<string, Validator<unknown>> = {};
  for (let i = 0; i < 10; i++) shape[`f${i}`] = xoe.lazy(() => node);
  const node = xoe.object(shape);

  const [, ms] = timed(() => node.validate({}));
  expect(ms < 1000, `${Math.round(ms)} ms`).toStrictEqual(true);
  expect(node.isAsync).toStrictEqual(false);
});

test("V15 - jsonSchema and toJsonSchema of interlinked $defs are fast", () => {
  const names = Array.from({ length: 11 }, (_, i) => `S${i}`);
  const $defs = Object.fromEntries(
    names.map((name) => [
      name,
      {
        type: "object",
        properties: Object.fromEntries(
          names.map((other) => [other, { $ref: `#/$defs/${other}` }]),
        ),
      },
    ]),
  );
  const schema = xoe.jsonSchema({
    $defs,
    $ref: "#/$defs/S0",
  } as JsonSchemaDefinition);

  const [, validateMs] = timed(() => schema.validate({}));
  expect(
    validateMs < 1000,
    `validate ${Math.round(validateMs)} ms`,
  ).toStrictEqual(true);
  const [, toJsonMs] = timed(() => toJsonSchema(schema));
  expect(
    toJsonMs < 1000,
    `toJsonSchema ${Math.round(toJsonMs)} ms`,
  ).toStrictEqual(true);
});

test("V15 - async rules behind a lazy cycle are still found", () => {
  type Node = { children: Node[]; name: string };
  const node: Validator<Node> = xoe.object({
    children: xoe.array(xoe.lazy(() => node)),
    name: xoe.string().refineAsync(() => Promise.resolve(true)),
  });
  const wrapper = xoe.object({
    a: xoe.lazy(() => node),
    b: xoe.lazy(() => node),
  });

  expect(node.isAsync).toStrictEqual(true);
  expect(wrapper.isAsync).toStrictEqual(true);
});

test("V16 - array maxLength is checked before the items", () => {
  let calls = 0;
  const rows = xoe
    .array(
      xoe.string().refine(() => {
        calls++;
        return true;
      }),
    )
    .maxLength(3);

  const result = rows.validate(["a", "b", "c", "d", "e"]);
  expect(
    result.type === "error" && result.value.map((issue) => issue.code),
  ).toStrictEqual(["array.maxLength"]);
  expect(calls).toStrictEqual(0);
  expect(
    xoe.array(xoe.number()).maxLength(2).validate(["a", "b", "c"]),
  ).toStrictEqual({
    type: "error",
    value: [
      {
        code: "array.maxLength",
        message: "Must have at most 2 items.",
        params: { max: 2 },
        path: [],
      },
    ],
  });
  // Within the limit the items and the other rules run as before.
  expect(rows.validate(["a"]).type).toStrictEqual("success");
  expect(calls).toStrictEqual(1);
});

test("V16 - jsonSchema maxItems bounds the cost of uniqueItems", () => {
  const limited = xoe.jsonSchema({
    type: "array",
    maxItems: 100,
    uniqueItems: true,
  });
  const items = Array.from({ length: 10_000 }, (_, i) => ({ i }));

  const [result, ms] = timed(() => limited.validate(items));
  expect(result.type).toStrictEqual("error");
  expect(ms < 300, `${Math.round(ms)} ms`).toStrictEqual(true);
});

test("V17 - toFieldErrors handles thousands of issues quickly", () => {
  const result = xoe
    .array(xoe.object({ email: xoe.string() }))
    .validate(Array.from({ length: 5000 }, () => ({ email: 1 })));
  const issues = result.type === "error" ? result.value : [];

  const [errors, ms] = timed(() => toFieldErrors(issues));
  expect(Object.keys(errors).length).toStrictEqual(5000);
  expect(errors["4999.email"]).toStrictEqual(["Value must be text."]);
  expect(ms < 300, `${Math.round(ms)} ms`).toStrictEqual(true);
});

test("V18 - the concurrency limit drains a long queue in linear time", async () => {
  const limit = createLimit(10);
  const start = performance.now();
  await Promise.all(Array.from({ length: 60_000 }, (_, i) => limit(() => i)));
  const ms = performance.now() - start;
  expect(ms < 500, `${Math.round(ms)} ms`).toStrictEqual(true);
});
