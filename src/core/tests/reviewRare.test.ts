// Regression tests for the November 2026 code review findings with rare
// triggers (V34-V42) and its nits.
import { expect, test } from "vitest";
import xoe, {
  enMessages,
  localizeIssues,
  stringRules,
  Validator,
  XOEUsageError,
  XOEValidationOutput,
} from "../../index.ts";
import { deepEqual } from "../deepEqual.ts";
import { setOwn } from "../ownProperties.ts";
import { typeName } from "../typeName.ts";
import { expectedSuccess } from "./helpers.ts";

const codes = <T>(result: XOEValidationOutput<T>) =>
  result.type === "error"
    ? result.value.map((issue) => `${issue.path.join(".")}:${issue.code}`)
    : [];

test("V34 - a thenable value is passed to the first transform as is", () => {
  const promise = Promise.resolve(1);
  const wrapped = xoe
    .instanceOf(Promise)
    .transform((value) => ({
      wrapped: value,
    }))
    .validate(promise);

  expect(
    wrapped.type === "success" && wrapped.value.wrapped === promise,
  ).toStrictEqual(true);
});

test("V35 - default() and catch() refuse nested class instances", () => {
  class Money {
    constructor(readonly amount: number) {}
  }
  const price = xoe.object({ price: xoe.instanceOf(Money) });

  expect(() => price.default({ price: new Money(5) })).toThrow(XOEUsageError);
  expect(() => price.default({ price: new Money(5) })).toThrow(
    "can't be copied",
  );
  expect(() => price.catch({ price: new Money(1) })).toThrow(XOEUsageError);
  // A function default keeps the instance, plain values are still copied.
  const fresh = price
    .default(() => ({ price: new Money(5) }))
    .validate(undefined);
  expect(
    fresh.type === "success" && fresh.value.price instanceof Money,
  ).toStrictEqual(true);
  expect(
    xoe
      .unknown()
      .default({ when: new Date(0), tags: new Set(["a"]) })
      .validate(undefined),
  ).toStrictEqual(expectedSuccess({ when: new Date(0), tags: new Set(["a"]) }));
});

test("V36 - record key issues name the key", () => {
  const prices = xoe.record(xoe.enum(["eur", "usd"]), xoe.number());
  const result = prices.validate({ gbp: 5 }, { reportInput: true });

  expect(result.type === "error" && result.value[0].params).toStrictEqual({
    options: ["eur", "usd"],
    recordKey: "gbp",
  });
  expect(result.type === "error" && result.value[0].input).toStrictEqual("gbp");
  // Value issues are unchanged.
  const value = prices.validate({ eur: "x" }, { reportInput: true });
  expect(value.type === "error" && value.value[0].input).toStrictEqual("x");
});

test("V37 - record and jsonSchema objects reject Map, Set and Promise", () => {
  const record = xoe.record(xoe.number());
  const json = xoe.jsonSchema({ type: "object" });

  for (const value of [new Map([["a", 1]]), new Set([1]), Promise.resolve(1)]) {
    expect(codes(record.validate(value))).toStrictEqual([":type"]);
    expect(codes(json.validate(value))).toStrictEqual([":type"]);
  }
  expect(
    record.validate(Object.assign(Object.create(null), { a: 1 })).type,
  ).toStrictEqual("success");
  // object() accepts any object (documented).
  expect(xoe.object({}).validate(new Map()).type).toStrictEqual("success");
});

test("V38 - changing options and rule arguments later doesn't change validators", () => {
  const options: Record<string, Validator<unknown>> = {
    card: xoe.object({}),
  };
  const payment = xoe.discriminatedUnion("type", options);
  options.crypto = xoe.object({});
  expect(payment.validate({ type: "crypto" }).type).toStrictEqual("error");

  const unionOptions = [xoe.string()] as [ReturnType<typeof xoe.string>];
  const union = xoe.union(unionOptions);
  (unionOptions as unknown as unknown[]).push(xoe.number());
  expect(union.validate(1).type).toStrictEqual("error");

  const items = [xoe.string()] as [ReturnType<typeof xoe.string>];
  const tuple = xoe.tuple(items);
  (items as unknown as unknown[]).push(xoe.number());
  expect(tuple.validate(["a", 1]).type).toStrictEqual("error");

  const min = new Date(Date.UTC(2024, 0, 1));
  const after = xoe.date().isAfter(min);
  min.setUTCFullYear(2025);
  expect(after.validate(new Date(Date.UTC(2024, 5, 1))).type).toStrictEqual(
    "success",
  );

  const protocols = ["https"];
  const url = xoe.string().url(protocols);
  protocols.push("ftp");
  expect(url.validate("ftp://example.com").type).toStrictEqual("error");

  const types = ["image/png"];
  const upload = xoe.file().accept(types);
  types.push("application/pdf");
  expect(
    upload.validate(new File(["x"], "a.pdf", { type: "application/pdf" })).type,
  ).toStrictEqual("error");
});

test("V39 - the rule context can't be changed", () => {
  const writer = xoe.string().refine((_value, _data, context) => {
    (context as { isEmpty: unknown }).isEmpty = () => false;
    return true;
  });

  expect(() => writer.validate("a")).toThrow(TypeError);
  expect(
    codes(
      xoe
        .object({
          email: xoe.string().optional(),
          phone: xoe.string().optional(),
        })
        .requireOne()
        .validate({}),
    ),
  ).toStrictEqual([":object.requireOne"]);
});

test("V40 - the exported rule registries can't be changed", () => {
  expect(Object.isFrozen(stringRules)).toStrictEqual(true);
  expect(() => {
    (stringRules as unknown as Record<string, unknown>).email = () => null;
  }).toThrow(TypeError);
  expect(xoe.string().email().validate("not-an-email").type).toStrictEqual(
    "error",
  );
});

test("V41 - setOwn defines keys that Object.prototype has", () => {
  // A frozen prototype with these keys behaves like a frozen Object.prototype.
  const frozen = Object.freeze({
    constructor: 1,
    toString: 2,
    hasOwnProperty: 3,
  });
  const target = Object.create(frozen) as Record<string, unknown>;

  setOwn(target, "constructor", "a");
  setOwn(target, "toString", "b");
  setOwn(target, "hasOwnProperty", "c");
  setOwn(target, "plain", "d");
  expect([
    target.constructor,
    // oxlint-disable-next-line typescript/unbound-method -- read as a value, never called
    target.toString,
    // oxlint-disable-next-line typescript/unbound-method -- read as a value, never called
    target.hasOwnProperty,
    target.plain,
  ]).toStrictEqual(["a", "b", "c", "d"]);
});

test("V42 - deepEqual handles cycles, -0, holes, Map and Set", () => {
  // oxlint-disable-next-line typescript/no-explicit-any
  const a: any = { id: 1 };
  a.self = a;
  // oxlint-disable-next-line typescript/no-explicit-any
  const b: any = { id: 1 };
  b.self = b;
  const holey: number[] = new Array(2);
  holey[1] = 1;

  expect(deepEqual(a, b)).toStrictEqual(true);
  expect(deepEqual(a, { id: 1, self: { id: 2 } })).toStrictEqual(false);
  expect(deepEqual(0, -0)).toStrictEqual(true);
  expect(deepEqual(Number.NaN, Number.NaN)).toStrictEqual(true);
  expect(deepEqual(holey, [2, 1])).toStrictEqual(false);
  expect(deepEqual(new Map([[1, 2]]), new Map())).toStrictEqual(false);
  expect(deepEqual(new Map([[1, 2]]), new Map([[1, 3]]))).toStrictEqual(false);
  expect(
    deepEqual(new Map([["a", { x: 1 }]]), new Map([["a", { x: 1 }]])),
  ).toStrictEqual(true);
  expect(deepEqual(new Set(["x"]), new Set(["y"]))).toStrictEqual(false);
  expect(deepEqual(new Set([{ x: 1 }]), new Set([{ x: 1 }]))).toStrictEqual(
    true,
  );
  expect(
    codes(
      xoe
        .object({ node: xoe.unknown(), copy: xoe.unknown().sameAs("node") })
        .validate({ node: a, copy: b }),
    ),
  ).toStrictEqual([]);
});

test("V42 - a broken Date doesn't make validation throw", () => {
  const fake = Object.create(Date.prototype);

  expect(typeName(fake)).toStrictEqual("object");
  expect(codes(xoe.string().validate(fake))).toStrictEqual([":type"]);
  expect(codes(xoe.date().validate(fake))).toStrictEqual([":type"]);
});

test("S1 - catchall(v).passthrough() keeps the catchall", () => {
  const scores = xoe
    .object({ name: xoe.string() })
    .catchall(xoe.coerce.number())
    .passthrough();

  expect(scores.validate({ name: "a", x: "1" })).toStrictEqual(
    expectedSuccess({ name: "a", x: 1 }),
  );
  expect(codes(scores.validate({ name: "a", x: "abc" }))).toStrictEqual([
    "x:type",
  ]);
});

test("S2 - object.strict names the unknown keys", () => {
  const result = xoe.object({ a: xoe.string() }).strict().validate({
    a: "x",
    secret: 1,
    other: 2,
  });

  expect(result.type === "error" && result.value[0].params).toStrictEqual({
    allowedKeys: ["a"],
    keys: ["secret", "other"],
  });
});

test("S4 - type messages ignore Object.prototype names", () => {
  const constructorType = xoe.instanceOf(class constructor {});
  const result = constructorType.validate(1);

  expect(result.type === "error" && result.value[0].message).toStrictEqual(
    "Value must be of type constructor.",
  );
  expect(
    result.type === "error" &&
      localizeIssues(result.value, enMessages)[0].message,
  ).toStrictEqual("Value must be of type constructor.");
});

test("S5 - literal messages keep brackets around arrays", () => {
  const result = xoe.jsonSchema({ const: [1, 2] }).validate("x");

  expect(result.type === "error" && result.value[0].message).toStrictEqual(
    "Value must be [1,2].",
  );
});
