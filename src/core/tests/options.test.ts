import { expect, test } from "vitest";
import xoe, { Infer, toFieldErrors, XOEValidationOutput } from "../../index.ts";
import { expectedSuccess } from "./helpers.ts";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;

const fieldErrors = <T>(result: XOEValidationOutput<T>) =>
  result.type === "error" ? toFieldErrors(result.value) : {};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const rejection = async (promise: Promise<unknown>): Promise<unknown> => {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("expected a rejection");
};

test("signal - an aborted signal rejects before any check runs", async () => {
  let calls = 0;
  const username = xoe.string().refineAsync(() => {
    calls++;
    return Promise.resolve(true);
  });
  const controller = new AbortController();
  controller.abort(new Error("stale input"));

  const error = await rejection(
    username.validateAsync("john", { signal: controller.signal }),
  );

  expect((error as Error).message).toStrictEqual("stale input");
  expect(calls).toStrictEqual(0);
});

test("signal - aborting rejects at once and stops queued checks", async () => {
  const started: string[] = [];
  const list = xoe.array(
    xoe.string().refineAsync(async (value) => {
      started.push(value);
      await delay(50); // ignores the signal on purpose
      return true;
    }),
  );
  const controller = new AbortController();

  const validation = list.validateAsync(["a", "b", "c"], {
    signal: controller.signal,
    concurrency: 1,
  });
  await delay(5);
  const abortedAt = performance.now();
  controller.abort();
  const error = await rejection(validation);

  expect((error as DOMException).name).toStrictEqual("AbortError");
  expect(performance.now() - abortedAt < 40).toStrictEqual(true);
  await delay(60);
  expect(started).toStrictEqual(["a"]);
});

test("signal - checks receive the signal, e.g. for fetch", async () => {
  const controller = new AbortController();
  let received: AbortSignal | undefined;
  const email = xoe.string().refineAsync((_value, _data, { signal }) => {
    received = signal;
    return Promise.resolve(true);
  });

  await email.validateAsync("a@b.io", { signal: controller.signal });
  expect(received).toStrictEqual(controller.signal);
});

test("signal - validation without abort is unchanged", async () => {
  const controller = new AbortController();
  const schema = xoe.object({
    name: xoe.string().refineAsync(() => Promise.resolve(true)),
  });

  expect(
    await schema.validateAsync({ name: "x" }, { signal: controller.signal }),
  ).toStrictEqual(expectedSuccess({ name: "x" }));
});

const api = xoe.object({
  name: xoe.string(),
  note: xoe.string().optional(),
  age: xoe.number().optional(),
});

test("emptyValues - undefined treats empty strings and null as values", () => {
  expect(fieldErrors(api.validate({ name: "" }))).toStrictEqual({
    name: ["This field is required."],
  });
  expect(
    api.validate({ name: "", note: "" }, { emptyValues: "undefined" }),
  ).toStrictEqual(expectedSuccess({ name: "", note: "" }));
  expect(
    fieldErrors(
      api.validate({ name: "x", age: null }, { emptyValues: "undefined" }),
    ),
  ).toStrictEqual({ age: ["Value must be a number."] });
});

test("emptyValues - applies to requireOne, discriminators and validateAsync", async () => {
  const contact = xoe
    .object({
      email: xoe.string().optional(),
      phone: xoe.string().optional(),
    })
    .requireOne();
  expect(contact.validate({ email: "" }).type).toStrictEqual("error");
  expect(
    contact.validate({ email: "" }, { emptyValues: "undefined" }).type,
  ).toStrictEqual("success");

  const shape = xoe.discriminatedUnion("kind", { a: xoe.object({}) });
  const kind = shape.validate({ kind: "" }, { emptyValues: "undefined" });
  expect(
    kind.type === "error" && kind.value.map((issue) => issue.code),
  ).toStrictEqual(["discriminator"]);

  expect(
    await api.validateAsync({ name: "" }, { emptyValues: "undefined" }),
  ).toStrictEqual(expectedSuccess({ name: "" }));
});

test("emptyValues - rules get isEmpty in their context", () => {
  const seen: boolean[] = [];
  const value = xoe
    .object({ a: xoe.unknown() })
    .refine((object, _data, { isEmpty }) => {
      seen.push(isEmpty(object.a));
      return true;
    });

  value.validate({ a: null }, { emptyValues: "undefined" });
  expect(seen).toStrictEqual([false]);
});

test("refine - a type guard narrows the output type", () => {
  const role = xoe
    .string()
    .refine(
      (value): value is "admin" | "user" =>
        value === "admin" || value === "user",
      "Unknown role",
    );

  expect(role.validate("admin")).toStrictEqual(
    expectedSuccess("admin" as const),
  );
  expect(fieldErrors(role.validate("root"))).toStrictEqual({
    "": ["Unknown role"],
  });

  const schema = xoe.object({ role, backup: role.optional() });
  const isEqual: Equal<
    Infer<typeof schema>,
    {
      role: "admin" | "user";
      backup?: "admin" | "user" | null | undefined;
    }
  > = true;
  expect(isEqual).toStrictEqual(true);
});

test("refine - a boolean check keeps the type", () => {
  const even = xoe.number().refine((value: number): boolean => value % 2 === 0);

  const isEqual: Equal<Infer<typeof even>, number> = true;
  expect(isEqual).toStrictEqual(true);
});
