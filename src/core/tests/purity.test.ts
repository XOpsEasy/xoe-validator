import { expect, test } from "vitest";
import xoe from "../../index.ts";

test("regexMatch - doesn't change the caller's RegExp", () => {
  const userRegex = /ab/g;
  const validator = xoe.string().regexMatch(userRegex);

  for (const value of ["xxab", "ab", "nope", "xxab"]) validator.validate(value);

  expect(userRegex.lastIndex).toStrictEqual(0);
  expect(userRegex.flags).toStrictEqual("g");
});

test("regexMatch - same result on every call, whatever the flags", () => {
  for (const regex of [/ab/, /ab/g, /AB/gi]) {
    const validator = xoe.string().regexMatch(regex);
    const results = ["xxab", "xxab", "nope", "ab"].map(
      (value) => validator.validate(value).type,
    );
    expect(results, String(regex)).toStrictEqual([
      "success",
      "success",
      "error",
      "success",
    ]);
  }
});

test("regexMatch - a sticky pattern still matches from the start", () => {
  const validator = xoe.string().regexMatch(/ab/y);

  expect(validator.validate("abx").type).toStrictEqual("success");
  expect(validator.validate("xab").type).toStrictEqual("error");
  expect(validator.validate("abx").type).toStrictEqual("success");
});

const fixedClock = (iso: string) => () => new Date(iso);

test("inFuture / inPast - the clock can be passed in", () => {
  const now = fixedClock("2030-01-01T00:00:00Z");
  const future = xoe.date().inFuture({ now });
  const past = xoe.date().inPast({ now });

  expect(future.validate(new Date("2030-01-02")).type).toStrictEqual("success");
  expect(future.validate(new Date("2029-12-31")).type).toStrictEqual("error");
  expect(future.validate(new Date("2030-01-01T00:00:00Z")).type).toStrictEqual(
    "error",
  );
  expect(past.validate(new Date("2029-12-31")).type).toStrictEqual("success");
  expect(past.validate(new Date("2030-01-02")).type).toStrictEqual("error");
});

test("inFuture / inPast - the clock is read on every validation", () => {
  let time = new Date("2030-01-01").getTime();
  const deadline = xoe.date().inFuture({ now: () => time });
  const date = new Date("2030-06-01");

  expect(deadline.validate(date).type).toStrictEqual("success");
  time = new Date("2031-01-01").getTime();
  expect(deadline.validate(date).type).toStrictEqual("error");
});

test("inFuture / inPast - message as a string or in the options", () => {
  const now = fixedClock("2030-01-01");
  const messageOf = (result: { type: string; value: unknown }) =>
    result.type === "error"
      ? (result.value as { message: string }[])[0].message
      : undefined;

  expect(
    messageOf(xoe.date().inFuture("Pick a future date").validate(new Date(0))),
  ).toStrictEqual("Pick a future date");
  expect(
    messageOf(
      xoe
        .date()
        .inPast({ message: "Must be past", now })
        .validate(new Date("2031-01-01")),
    ),
  ).toStrictEqual("Must be past");
});
