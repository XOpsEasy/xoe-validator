import { expect, test } from "vitest";
import { deepEqual } from "../deepEqual.ts";

test("deepEqual - primitives", () => {
  expect(deepEqual(1, 1)).toStrictEqual(true);
  expect(deepEqual("a", "b")).toStrictEqual(false);
  expect(deepEqual(Number.NaN, Number.NaN)).toStrictEqual(true);
  expect(deepEqual(null, undefined)).toStrictEqual(false);
  expect(deepEqual(null, {})).toStrictEqual(false);
});

test("deepEqual - arrays are not equal to array-like objects", () => {
  expect(deepEqual([1, 2], [1, 2])).toStrictEqual(true);
  expect(deepEqual([1, 2], [2, 1])).toStrictEqual(false);
  expect(deepEqual([1], { 0: 1 })).toStrictEqual(false);
  expect(deepEqual({ 0: 1 }, [1])).toStrictEqual(false);
  expect(deepEqual([], {})).toStrictEqual(false);
});

test("deepEqual - nested objects", () => {
  expect(
    deepEqual({ a: { b: [1, { c: 2 }] } }, { a: { b: [1, { c: 2 }] } }),
  ).toStrictEqual(true);
  expect(deepEqual({ a: { b: [1] } }, { a: { b: [2] } })).toStrictEqual(false);
  expect(deepEqual({ a: undefined }, { b: undefined })).toStrictEqual(false);
  expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toStrictEqual(false);
});

test("deepEqual - dates", () => {
  expect(
    deepEqual(new Date("2023-01-01"), new Date("2023-01-01")),
  ).toStrictEqual(true);
  expect(
    deepEqual(new Date("2023-01-01"), new Date("2023-01-02")),
  ).toStrictEqual(false);
  expect(deepEqual(new Date(0), {})).toStrictEqual(false);
  expect(deepEqual({}, new Date(0))).toStrictEqual(false);
});

test("deepEqual - different prototypes", () => {
  expect(deepEqual(new Map(), {})).toStrictEqual(false);
  expect(deepEqual(Object.create(null), {})).toStrictEqual(false);
});
