import { expect, test } from "vitest";
import xoe, {
  bimap,
  flatMap,
  flatMapAsync,
  fromPromise,
  map,
  mapError,
  toFieldErrors,
  tryCatch,
  xoeError,
  XOEIssue,
  XOEResult,
  xoeSuccess,
} from "../../index.ts";

test("mapError - changes only errors", () => {
  const result = xoe.object({ a: xoe.string() }).validate({});

  expect(mapError(result, toFieldErrors)).toStrictEqual({
    type: "error",
    value: { a: ["This field is required."] },
  });
  expect(
    mapError(xoeSuccess<number, string>(1), (e) => e.length),
  ).toStrictEqual({
    type: "success",
    value: 1,
  });
});

test("bimap - maps both sides", () => {
  const describe = (result: XOEResult<number, string[]>) =>
    bimap(
      result,
      (errors) => errors.join(", "),
      (n) => n * 2,
    );

  expect(describe(xoeSuccess(2))).toStrictEqual(xoeSuccess(4));
  expect(describe(xoeError(["a", "b"]))).toStrictEqual(xoeError("a, b"));
});

test("tryCatch - turns throwing code into a result", () => {
  const parse = (text: string) =>
    tryCatch(
      () => JSON.parse(text) as unknown,
      () => "Invalid JSON",
    );

  expect(parse('{"a":1}')).toStrictEqual(xoeSuccess({ a: 1 }));
  expect(parse("{")).toStrictEqual(xoeError("Invalid JSON"));
});

test("fromPromise - turns rejections into errors", async () => {
  expect(await fromPromise(Promise.resolve(5), String)).toStrictEqual(
    xoeSuccess(5),
  );
  expect(
    await fromPromise(
      Promise.reject(new Error("offline")),
      (reason) => (reason as Error).message,
    ),
  ).toStrictEqual(xoeError("offline"));
});

test("helpers compose with validation", () => {
  const body = xoe.object({ id: xoe.coerce.number().positive() });
  const load = (text: string) => {
    const parsed = tryCatch(
      () => JSON.parse(text) as unknown,
      (): readonly XOEIssue[] => [
        { code: "json", message: "Invalid JSON", path: [] },
      ],
    );
    const validated = flatMap(parsed, (value) => body.validate(value));
    return mapError(validated, toFieldErrors);
  };

  expect(load('{"id":"7"}')).toStrictEqual(xoeSuccess({ id: 7 }));
  expect(load("{")).toStrictEqual(xoeError({ "": ["Invalid JSON"] }));
  expect(load('{"id":-1}')).toStrictEqual(
    xoeError({ id: ["Must be greater than 0."] }),
  );
});

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;

test("map helpers - async functions are a type error", () => {
  const result = xoeSuccess<number, string>(1);
  const typeChecks = () => {
    // @ts-expect-error a promise would end up inside the result
    map(result, (n) => Promise.resolve(n + 1));
    // @ts-expect-error mapError too
    mapError(result, (e) => Promise.resolve(e.length));
    // oxfmt-ignore
    // @ts-expect-error bimap too
    bimap(result, (e) => e, (n) => Promise.resolve(n));
    // @ts-expect-error tryCatch too (use fromPromise)
    tryCatch(() => Promise.resolve(1), String);
  };

  const mapped = map(result, (n) => String(n));
  const isEqual: Equal<typeof mapped, XOEResult<string, string>> = true;
  expect([typeof typeChecks, isEqual]).toStrictEqual(["function", true]);
  expect(mapped).toStrictEqual(xoeSuccess("1"));
});

type User = { id: number; name: string };
const users: Record<number, User> = { 7: { id: 7, name: "Ana" } };
const fetchUser = (id: number): Promise<XOEResult<User, readonly XOEIssue[]>> =>
  Promise.resolve(
    users[id]
      ? xoeSuccess(users[id])
      : xoeError([
          {
            code: "user.notFound",
            message: "User not found",
            path: [],
          },
        ]),
  );

test("flatMapAsync - chains async steps without manual checks", async () => {
  const loadUser = (input: unknown) =>
    flatMapAsync(xoe.coerce.number().integer().validate(input), fetchUser);

  expect(await loadUser("7")).toStrictEqual(xoeSuccess({ id: 7, name: "Ana" }));
  expect(mapError(await loadUser("8"), toFieldErrors)).toStrictEqual(
    xoeError({ "": ["User not found"] }),
  );
  expect(mapError(await loadUser("x"), toFieldErrors)).toStrictEqual(
    xoeError({ "": ["Value must be a number."] }),
  );
});

test("flatMapAsync - errors short-circuit and inputs may be promises", async () => {
  let calls = 0;
  const step = (n: number) => {
    calls++;
    return xoeSuccess<number, string>(n * 2);
  };

  expect(
    await flatMapAsync(xoeError<string, number>("bad"), step),
  ).toStrictEqual(xoeError("bad"));
  expect(calls).toStrictEqual(0);
  expect(
    await flatMapAsync(Promise.resolve(xoeSuccess(2)), step),
  ).toStrictEqual(xoeSuccess(4));

  const username = xoe
    .string()
    .refineAsync((v) => Promise.resolve(v !== "taken"));
  const greeting = await flatMapAsync(username.validateAsync("ana"), (name) =>
    xoeSuccess(`Hi ${name}`),
  );
  expect(greeting).toStrictEqual(xoeSuccess("Hi ana"));
});

test("flatMapAsync - error types may differ", async () => {
  const step = (n: number): XOEResult<number, "tooBig"> =>
    n > 10 ? xoeError("tooBig") : xoeSuccess(n);
  const result = await flatMapAsync(xoeSuccess<number, "missing">(20), step);

  const isEqual: Equal<
    typeof result,
    XOEResult<number, "missing" | "tooBig">
  > = true;
  expect([isEqual, result]).toStrictEqual([true, xoeError("tooBig")]);
});
