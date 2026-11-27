// Loads the packed package with import, as an ESM user would.
import assert from "node:assert/strict";
import xoe, {
  enMessages,
  localizeIssues,
  object,
  string,
  toFieldErrors,
  toJsonSchema,
} from "@x-ops-easy/xoe-validator";

const signUp = xoe.object({
  name: xoe.string().trim().minLength(2),
  age: xoe.coerce.number().minimum(18),
  role: xoe.enum(["admin", "user"]).default("user"),
});

assert.deepEqual(signUp.validate({ name: " Ana ", age: "30", extra: 1 }), {
  type: "success",
  value: { name: "Ana", age: 30, role: "user" },
});

const failed = signUp.validate({ name: "A", age: "17" });
assert.equal(failed.type, "error");
assert.deepEqual(toFieldErrors(failed.value), {
  name: ["Must be at least 2 characters long."],
  age: ["Must be greater than or equal to 18."],
});
assert.equal(
  localizeIssues(failed.value, enMessages)[0].message,
  "Must be at least 2 characters long.",
);

// Named exports and async validation.
const free = object({
  user: string().refineAsync((name) => Promise.resolve(name !== "taken")),
});
assert.equal((await free.validateAsync({ user: "taken" })).type, "error");
assert.equal((await free.validateAsync({ user: "free" })).type, "success");

// JSON Schema in both directions.
const fromSchema = xoe.jsonSchema({
  type: "object",
  required: ["id"],
  properties: { id: { type: "integer", minimum: 1 } },
});
assert.equal(fromSchema.validate({ id: 0 }).type, "error");
assert.equal(toJsonSchema(xoe.string().email()).format, "email");

console.log(`esm: ok (Node ${process.versions.node})`);
