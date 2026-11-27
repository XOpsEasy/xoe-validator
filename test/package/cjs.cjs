// Loads the packed package with require, as a CommonJS user would.
const assert = require("node:assert/strict");
const lib = require("@xopseasy/xoe-validator");

const xoe = lib.default;
assert.equal(typeof xoe.string, "function");
assert.equal(typeof lib.object, "function");

const user = xoe.object({ email: xoe.string().email() });
assert.deepEqual(user.validate({ email: "a@b.io" }), {
  type: "success",
  value: { email: "a@b.io" },
});
assert.equal(user.validate({ email: "nope" }).type, "error");

assert.throws(
  () =>
    xoe
      .string()
      .refineAsync(() => Promise.resolve(true))
      .validate("x"),
  (error) =>
    error instanceof lib.XOEUsageError && error.code === "ASYNC_IN_SYNC",
);

console.log(`cjs: ok (Node ${process.versions.node})`);
