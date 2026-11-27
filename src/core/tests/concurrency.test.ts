import { expect, test } from "vitest";
import xoe, { toFieldErrors, Validator, XOEUsageError } from "../../index.ts";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Async check that records how many checks run at the same time. */
const tracker = () => {
  let active = 0;
  const stats = { maxActive: 0, calls: 0, finished: [] as string[] };
  const check =
    (ms: number, valid = true) =>
    async (value: unknown) => {
      stats.calls++;
      active++;
      stats.maxActive = Math.max(stats.maxActive, active);
      await delay(ms);
      active--;
      stats.finished.push(String(value));
      return valid;
    };
  return { stats, check };
};

test("concurrency - async object fields run in parallel", async () => {
  const { stats, check } = tracker();
  const schema = xoe.object({
    a: xoe.string().refineAsync(check(10)),
    b: xoe.string().refineAsync(check(10)),
    c: xoe.string().refineAsync(check(10)),
  });

  expect(
    (await schema.validateAsync({ a: "a", b: "b", c: "c" })).type,
  ).toStrictEqual("success");
  expect(stats.maxActive).toStrictEqual(3);
});

test("concurrency - issues and output keep the field order", async () => {
  const { stats, check } = tracker();
  const schema = xoe.object({
    slow: xoe.string().refineAsync(check(30, false), "slow failed"),
    fast: xoe.string().refineAsync(check(1, false), "fast failed"),
    plain: xoe.string().trim(),
  });

  const result = await schema.validateAsync({
    slow: "s",
    fast: "f",
    plain: " p ",
  });

  expect(stats.finished).toStrictEqual(["f", "s"]);
  expect(result.type === "error" && toFieldErrors(result.value)).toStrictEqual({
    slow: ["slow failed"],
    fast: ["fast failed"],
  });

  const ok = xoe.object({
    slow: xoe.string().refineAsync(check(30)),
    fast: xoe.string().refineAsync(check(1)),
  });
  const output = await ok.validateAsync({ slow: "s", fast: "f" });
  expect(Object.keys(output.value as object)).toStrictEqual(["slow", "fast"]);
});

test("concurrency - async array items and record entries run in parallel", async () => {
  const items = tracker();
  const list = xoe.array(xoe.string().refineAsync(items.check(10)));
  const result = await list.validateAsync(["a", "b", "c", "d"]);

  expect(result).toStrictEqual({
    type: "success",
    value: ["a", "b", "c", "d"],
  });
  expect(items.stats.maxActive).toStrictEqual(4);

  const entries = tracker();
  const record = xoe.record(xoe.string().refineAsync(entries.check(10)));
  await record.validateAsync({ x: "1", y: "2", z: "3" });
  expect(entries.stats.maxActive).toStrictEqual(3);
});

test("concurrency - async rules of one value run in parallel", async () => {
  const { stats, check } = tracker();
  const username = xoe
    .string()
    .refineAsync(check(10), "taken")
    .refineAsync(check(10), "blocked");

  await username.validateAsync("john");
  expect(stats.maxActive).toStrictEqual(2);
});

test("concurrency - abortEarly runs in order and stops at the first issue", async () => {
  const { stats, check } = tracker();
  const schema = xoe
    .object({
      a: xoe.string().refineAsync(check(5, false), "a failed"),
      b: xoe.string().refineAsync(check(5)),
      c: xoe.string().refineAsync(check(5)),
    })
    .abortEarly();

  const result = await schema.validateAsync({ a: "a", b: "b", c: "c" });

  expect(stats.maxActive).toStrictEqual(1);
  expect(stats.calls).toStrictEqual(1);
  expect(result.type === "error" && toFieldErrors(result.value)).toStrictEqual({
    a: ["a failed"],
  });
});

test("concurrency - validate keeps throwing for async trees", () => {
  type Node = { name: string; children: Node[] };
  const node: Validator<Node> = xoe.object({
    name: xoe.string().refineAsync(() => Promise.resolve(true)),
    children: xoe.array(xoe.lazy(() => node)),
  });

  for (let i = 0; i < 2; i++) {
    expect(() => node.validate({ name: "a", children: [] })).toThrow(
      "validateAsync",
    );
  }
});

test("concurrency - async rules are limited to 10 by default", async () => {
  const { stats, check } = tracker();
  const list = xoe.array(xoe.string().refineAsync(check(2)));
  const items = Array.from({ length: 100 }, (_, i) => String(i));

  const result = await list.validateAsync(items);

  expect(result).toStrictEqual({ type: "success", value: items });
  expect(stats.maxActive).toStrictEqual(10);
  expect(stats.calls).toStrictEqual(100);
});

test("concurrency - the limit can be changed per call", async () => {
  const limited = tracker();
  const list = xoe.array(xoe.string().refineAsync(limited.check(2)));
  await list.validateAsync(["a", "b", "c", "d", "e", "f"], { concurrency: 2 });
  expect(limited.stats.maxActive).toStrictEqual(2);

  const unlimited = tracker();
  const all = xoe.array(xoe.string().refineAsync(unlimited.check(2)));
  await all.validateAsync(
    Array.from({ length: 30 }, (_, i) => String(i)),
    { concurrency: Infinity },
  );
  expect(unlimited.stats.maxActive).toStrictEqual(30);
});

test("concurrency - the limit applies to the whole tree", async () => {
  const { stats, check } = tracker();
  const users = xoe.array(
    xoe.object({
      email: xoe.string().refineAsync(check(2)),
      username: xoe.string().refineAsync(check(2)),
      tags: xoe.record(xoe.string().refineAsync(check(2))),
    }),
  );
  const data = Array.from({ length: 10 }, (_, i) => ({
    email: `e${i}`,
    username: `u${i}`,
    tags: { a: "x", b: "y" },
  }));

  expect(
    (await users.validateAsync(data, { concurrency: 4 })).type,
  ).toStrictEqual("success");
  expect(stats.maxActive).toStrictEqual(4);
  expect(stats.calls).toStrictEqual(40);
});

test("concurrency - a rejected check frees its slot", async () => {
  let calls = 0;
  const list = xoe.array(
    xoe.string().refineAsync(async (value) => {
      calls++;
      await delay(1);
      if (value === "bad") throw new Error("network");
      return true;
    }),
  );

  let error: unknown;
  try {
    await list.validateAsync(["bad", "a", "b"], { concurrency: 1 });
  } catch (e) {
    error = e;
  }
  expect((error as Error).message).toStrictEqual("network");

  // The limit of the next call is not blocked by the failed one.
  expect(
    (await list.validateAsync(["a"], { concurrency: 1 })).type,
  ).toStrictEqual("success");
  expect(calls >= 2).toStrictEqual(true);
});

test("concurrency - invalid limits are rejected", async () => {
  const value = xoe.string().refineAsync(() => Promise.resolve(true));

  for (const concurrency of [0, -1, Number.NaN]) {
    let error: unknown;
    try {
      await value.validateAsync("x", { concurrency });
    } catch (e) {
      error = e;
    }
    expect(error instanceof XOEUsageError, String(concurrency)).toStrictEqual(
      true,
    );
    expect((error as XOEUsageError).code).toStrictEqual("INVALID_CONCURRENCY");
  }
});
