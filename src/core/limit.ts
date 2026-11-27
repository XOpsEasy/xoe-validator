import { XOEUsageError } from "./errors.ts";
import { MaybePromise } from "./validatorTypes.ts";

/**
 * Runs tasks with at most `concurrency` of them in progress at a time.
 * close(reason) rejects the queued tasks without starting them, e.g. when the
 * validation they belong to already failed.
 */
export type Limit = {
  <T>(task: () => MaybePromise<T>): Promise<T>;
  close: (reason: unknown) => void;
};

export const DEFAULT_CONCURRENCY = 10;

export const createLimit = (concurrency: number): Limit => {
  if (!(concurrency >= 1)) {
    throw new XOEUsageError(
      "INVALID_CONCURRENCY",
      `xoe: concurrency must be at least 1, got ${concurrency}.`,
    );
  }

  type Queued = { start: () => void; reject: (reason: unknown) => void };
  let active = 0;
  let closed: { reason: unknown } | undefined;
  // A queue with a head index: shift() copies the array, which makes long
  // queues quadratic.
  let queue: Queued[] = [];
  let head = 0;
  const release = () => {
    active--;
    if (head === queue.length) return;
    const next = queue[head++];
    if (head === queue.length) {
      queue = [];
      head = 0;
    }
    next.start();
  };

  const limit = <T>(task: () => MaybePromise<T>) =>
    new Promise<T>((resolve, reject) => {
      if (closed) return reject(closed.reason);
      const start = () => {
        active++;
        Promise.resolve().then(task).then(resolve, reject).finally(release);
      };
      if (active < concurrency) start();
      else queue.push({ start, reject });
    });

  return Object.assign(limit, {
    close: (reason: unknown) => {
      if (closed) return;
      closed = { reason };
      const waiting = queue.slice(head);
      queue = [];
      head = 0;
      for (const { reject } of waiting) reject(reason);
    },
  });
};
