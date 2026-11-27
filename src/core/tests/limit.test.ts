import { expect, test } from "vitest";
import { createLimit } from "../limit.ts";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test("createLimit - starts queued tasks in order", async () => {
  const limit = createLimit(2);
  const started: number[] = [];
  const task = (id: number) => async () => {
    started.push(id);
    await delay(5);
    return id;
  };

  const results = await Promise.all(
    [1, 2, 3, 4, 5].map((id) => limit(task(id))),
  );

  expect(results).toStrictEqual([1, 2, 3, 4, 5]);
  expect(started).toStrictEqual([1, 2, 3, 4, 5]);
});

test("createLimit - errors are passed on and free the slot", async () => {
  const limit = createLimit(1);
  const failed = limit(() => Promise.reject(new Error("boom")));
  const next = limit(() => "done");

  let message = "";
  await failed.catch((error: Error) => (message = error.message));
  expect(message).toStrictEqual("boom");
  expect(await next).toStrictEqual("done");
});

test("createLimit - sync tasks and thrown errors", async () => {
  const limit = createLimit(1);

  expect(await limit(() => 42)).toStrictEqual(42);
  let message = "";
  await limit(() => {
    throw new Error("sync");
  }).catch((error: Error) => (message = error.message));
  expect(message).toStrictEqual("sync");
});
