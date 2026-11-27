import { expect, test } from "vitest";
import xoe, { createRule, IsAsync, Validator } from "../../index.ts";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;

const isTaken = (value: string) => Promise.resolve(value !== "taken");

// The calls marked with @ts-expect-error are only type-checked: the test
// fails to type-check if any of them is allowed.
const typeChecks = () => {
  // @ts-expect-error refineAsync makes validate() a type error
  xoe.string().refineAsync(isTaken).validate("x");
  // oxfmt-ignore
  // @ts-expect-error superRefineAsync too
  xoe.string().superRefineAsync(() => Promise.resolve([])).validate("x");
  // oxfmt-ignore
  // @ts-expect-error an async transform too
  xoe.string().transform((v) => Promise.resolve(v.length)).validate("x");
  // @ts-expect-error piping into an async validator too
  xoe.string().pipe(xoe.string().refineAsync(isTaken)).validate("x");

  const signUp = xoe.object({
    email: xoe.string().email(),
    username: xoe.string().refineAsync(isTaken),
  });
  // @ts-expect-error an object with an async field is async
  signUp.validate({});
  // @ts-expect-error async stays through the chain
  signUp.strict().optional().validate({});
  // @ts-expect-error partial keeps the async field
  signUp.partial().validate({});

  // @ts-expect-error arrays, tuples, records and unions with async parts
  xoe.array(xoe.string().refineAsync(isTaken)).validate([]);
  // @ts-expect-error tuple
  xoe.tuple([xoe.number(), xoe.string().refineAsync(isTaken)]).validate([]);
  // @ts-expect-error record
  xoe.record(xoe.string().refineAsync(isTaken)).validate({});
  // @ts-expect-error union
  xoe.union([xoe.number(), xoe.string().refineAsync(isTaken)]).validate(1);
  // @ts-expect-error discriminated union
  xoe.discriminatedUnion("type", { a: signUp }).validate({});

  // Sync validators and sync parts of async objects can use validate().
  signUp.pick("email").validate({});
  signUp.omit("username").validate({});
  xoe
    .object({ a: xoe.string() })
    .refine(() => true)
    .validate({});
  xoe
    .string()
    .transform((v) => v.length)
    .validate("x");
  xoe.jsonSchema({ type: "string" }).validate("x");
};

test("async types - validate() is a type error for async validators", async () => {
  expect(typeof typeChecks).toStrictEqual("function");

  const username = xoe.string().refineAsync(isTaken, "Username is taken");
  expect((await username.validateAsync("taken")).type).toStrictEqual("error");
});

test("async types - IsAsync", () => {
  const sync = xoe.object({ a: xoe.string() });
  const async = xoe.object({ a: xoe.string().refineAsync(isTaken) });

  const checks: [
    Equal<IsAsync<typeof sync>, false>,
    Equal<IsAsync<typeof async>, true>,
    Equal<IsAsync<ReturnType<typeof async.pick<"a">>>, true>,
    Equal<IsAsync<Validator<string>>, boolean>,
  ] = [true, true, true, true];
  expect(checks).toStrictEqual([true, true, true, true]);
});

test("async types - not known means validate() is allowed, runtime still checks", () => {
  // A hand-written Validator<Node> doesn't know whether it is async.
  type Node = { name: string; children: Node[] };
  const node: Validator<Node> = xoe.object({
    name: xoe.string().refineAsync(isTaken),
    children: xoe.array(xoe.lazy(() => node)),
  });
  expect(() => node.validate({ name: "a", children: [] })).toThrow(
    "validateAsync",
  );

  // Async rules added with with() keep the type sync; runtime still throws.
  const asyncRule = createRule<string>({
    code: "x",
    message: "x",
    async: true,
    check: () => Promise.resolve(true),
  });
  expect(() => xoe.string().with(asyncRule).validate("x")).toThrow(
    "validateAsync",
  );
});
