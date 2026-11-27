import { expect, test } from "vitest";
import type { StandardSchemaV1 as OfficialSchema } from "@standard-schema/spec";
import xoe, { InferInput, StandardSchemaV1, Validator } from "../../index.ts";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;

/** What a library that accepts any Standard Schema does. */
const standardValidate = async <S extends OfficialSchema>(
  schema: S,
  value: unknown,
): Promise<OfficialSchema.Result<OfficialSchema.InferOutput<S>>> =>
  await schema["~standard"].validate(value);

const signUp = xoe.object({
  email: xoe.string().email(),
  age: xoe.coerce.number().integer().minimum(18),
  newsletter: xoe.coerce.boolean().default(false),
});

test("standard schema - props", () => {
  const props = signUp["~standard"];

  expect(props.version).toStrictEqual(1);
  expect(props.vendor).toStrictEqual("xoe");
  expect(typeof props.validate).toStrictEqual("function");
});

test("standard schema - success returns the parsed value", async () => {
  expect(
    await standardValidate(signUp, { email: "a@b.io", age: "21" }),
  ).toStrictEqual({ value: { email: "a@b.io", age: 21, newsletter: false } });
});

test("standard schema - failure returns issues with message and path", async () => {
  const result = await standardValidate(signUp, { email: "nope", age: "12" });

  expect(
    result.issues?.map(({ message, path }) => ({ message, path })),
  ).toStrictEqual([
    { message: "Invalid email address.", path: ["email"] },
    {
      message: "Must be greater than or equal to 18.",
      path: ["age"],
    },
  ]);
});

test("standard schema - sync validators answer synchronously", () => {
  const result = xoe.string()["~standard"].validate(1);

  expect(result instanceof Promise).toStrictEqual(false);
  expect(
    (result as StandardSchemaV1.FailureResult).issues.length,
  ).toStrictEqual(1);
});

test("standard schema - async validators return a promise", async () => {
  const username = xoe
    .string()
    .refineAsync(
      (value) => Promise.resolve(value !== "taken"),
      "Username is taken",
    );
  const result = username["~standard"].validate("taken");

  expect(result instanceof Promise).toStrictEqual(true);
  expect((await result).issues?.[0].message).toStrictEqual("Username is taken");
});

test("standard schema - works for every kind of validator", async () => {
  type Node = { name: string; children: Node[] };
  const node: Validator<Node> = xoe.object({
    name: xoe.string(),
    children: xoe.array(xoe.lazy(() => node)),
  });
  const validators: OfficialSchema[] = [
    xoe.string().transform((value) => value.length),
    xoe.union([xoe.string(), xoe.number()]),
    xoe.tuple([xoe.number()]),
    xoe.record(xoe.number()),
    xoe.jsonSchema({ type: "string" }),
    node,
  ];

  for (const validator of validators) {
    const result = await standardValidate(validator, Symbol("invalid"));
    expect(Array.isArray(result.issues)).toStrictEqual(true);
  }
});

test("standard schema - inferred input and output types", () => {
  type Input = OfficialSchema.InferInput<typeof signUp>;
  type Output = OfficialSchema.InferOutput<typeof signUp>;

  const input: Equal<
    Input,
    {
      email: string;
      age: string | number;
      newsletter?: string | number | boolean | null | undefined;
    }
  > = true;
  const output: Equal<
    Output,
    { email: string; age: number; newsletter: boolean }
  > = true;
  const sameAsInferInput: Equal<Input, InferInput<typeof signUp>> = true;

  expect([input, output, sameAsInferInput]).toStrictEqual([true, true, true]);
});
