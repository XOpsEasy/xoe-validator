import { expect, test } from "vitest";
import xoe, { Infer, InferInput } from "../../index.ts";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;

const check = (...results: boolean[]) =>
  expect(results.every(Boolean)).toStrictEqual(true);

test("InferInput - leaf validators", () => {
  check(
    true as Equal<InferInput<ReturnType<typeof xoe.string>>, string>,
    true as Equal<
      InferInput<ReturnType<typeof xoe.coerce.number>>,
      number | string
    >,
    true as Equal<
      InferInput<ReturnType<typeof xoe.coerce.boolean>>,
      boolean | string | number
    >,
    true as Equal<
      InferInput<ReturnType<typeof xoe.coerce.date>>,
      Date | string | number
    >,
    true as Equal<
      InferInput<ReturnType<typeof xoe.coerce.string>>,
      string | number | boolean | bigint
    >,
  );
});

test("InferInput - optional, default, required and transform", () => {
  const optional = xoe.string().optional();
  const withDefault = xoe.coerce.number().default(1);
  const required = xoe.string().optional().required();
  const length = xoe.string().transform((value) => value.length);

  check(
    true as Equal<InferInput<typeof optional>, string | null | undefined>,
    true as Equal<
      InferInput<typeof withDefault>,
      number | string | null | undefined
    >,
    true as Equal<Infer<typeof withDefault>, number>,
    true as Equal<InferInput<typeof required>, string>,
    true as Equal<InferInput<typeof length>, string>,
    true as Equal<Infer<typeof length>, number>,
  );
});

test("InferInput - objects, arrays, tuples, records and unions", () => {
  const user = xoe.object({
    name: xoe.string().trim(),
    age: xoe.coerce.number(),
    role: xoe.enum(["admin", "user"]).default("user"),
    tags: xoe.array(xoe.coerce.number()),
    point: xoe.tuple([xoe.coerce.number(), xoe.string().optional()]),
    prices: xoe.record(xoe.coerce.number()),
    id: xoe.union([xoe.coerce.number(), xoe.string().uuid()]),
  });

  check(
    true as Equal<
      InferInput<typeof user>,
      {
        name: string;
        age: string | number;
        tags: (string | number)[];
        point: [string | number, string | null | undefined];
        prices: Record<string, string | number>;
        id: string | number;
        role?: "admin" | "user" | null | undefined;
      }
    >,
  );
});

test("InferInput - object composition keeps input types", () => {
  const user = xoe.object({
    id: xoe.coerce.number(),
    email: xoe.string(),
  });
  const patch = user.omit("id").partial();
  const withAge = user.pick("id").extend({ age: xoe.coerce.number() });

  check(
    true as Equal<
      InferInput<typeof patch>,
      { email?: string | null | undefined }
    >,
    true as Equal<
      InferInput<typeof withAge>,
      { id: string | number; age: string | number }
    >,
  );
});

test("InferInput - discriminated unions", () => {
  const payment = xoe.discriminatedUnion("method", {
    card: xoe.object({ cvc: xoe.coerce.number() }),
    cash: xoe.object({}),
  });

  check(
    true as Equal<
      InferInput<typeof payment>,
      { method: "card"; cvc: string | number } | { method: "cash" }
    >,
  );
});
