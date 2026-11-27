import { expect, test } from "vitest";
import {
  all,
  flatMap,
  fold,
  isXOEError,
  map,
  xoeError,
  xoeSuccess,
} from "../result.ts";
import { XOEResult } from "../validatorTypes.ts";
import xoe from "../../index.ts";

test("result - fold", () => {
  const describe = (result: XOEResult<number, string[]>) =>
    fold(
      result,
      (errors) => `error: ${errors.join()}`,
      (value) => `ok: ${value}`,
    );

  expect(describe(xoeSuccess(1))).toStrictEqual("ok: 1");
  expect(describe(xoeError(["bad"]))).toStrictEqual("error: bad");
});

test("result - map transforms only success", () => {
  expect(map(xoeSuccess<number, string[]>(2), (n) => n * 2)).toStrictEqual(
    xoeSuccess(4),
  );
  expect(map(xoeError<string[], number>(["bad"]), (n) => n * 2)).toStrictEqual(
    xoeError(["bad"]),
  );
});

test("result - flatMap chains results", () => {
  const positive = (n: number): XOEResult<number, string[]> =>
    n > 0 ? xoeSuccess(n) : xoeError(["not positive"]);

  expect(flatMap(xoeSuccess<number, string[]>(3), positive)).toStrictEqual(
    xoeSuccess(3),
  );
  expect(flatMap(xoeSuccess<number, string[]>(-1), positive)).toStrictEqual(
    xoeError(["not positive"]),
  );
});

test("result - flatMap works with validator output", () => {
  const result = flatMap(xoe.string().minLength(3).validate("abc"), (value) =>
    xoe.string().contains("x").validate(value),
  );

  expect(isXOEError(result) && result.value[0].code).toStrictEqual(
    "string.contains",
  );
});

test("result - all combines sync and async results", async () => {
  const ok = (value: number): XOEResult<number, string[]> => xoeSuccess(value);
  const fail = (...errors: string[]): XOEResult<number, string[]> =>
    xoeError(errors);

  expect(await all([ok(1), Promise.resolve(ok(2))])).toStrictEqual(
    xoeSuccess([1, 2]),
  );
  expect(
    await all([fail("a"), ok(1), Promise.resolve(fail("b", "c"))]),
  ).toStrictEqual(xoeError(["a", "b", "c"]));
});
