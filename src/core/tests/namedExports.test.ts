import { expect, test } from "vitest";
import * as lib from "../../index.ts";
import xoe from "../../index.ts";

test("named exports - every validator of xoe is also a named export", () => {
  const named: Record<string, unknown> = lib;
  const nameOf = (key: string) => (key === "enum" ? "enumOf" : key);

  for (const [key, factory] of Object.entries(xoe)) {
    expect(named[nameOf(key)], key).toStrictEqual(factory);
  }
});

test("named exports - work like the xoe object", () => {
  const { object, string, coerce, enumOf } = lib;
  const user = object({
    name: string().minLength(2),
    age: coerce.number(),
    role: enumOf(["admin", "user"]),
  });

  expect(user.validate({ name: "Jo", age: "30", role: "user" })).toStrictEqual({
    type: "success",
    value: { name: "Jo", age: 30, role: "user" },
  });
});
