import { expect, test } from "vitest";
import xoe, { Infer, toFieldErrors } from "../../../index.ts";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;

class Money {
  constructor(readonly amount: number) {}
}

test("instanceOf - accepts instances of the class", () => {
  const price = xoe.instanceOf(Money).refine((money) => money.amount > 0);

  expect(price.validate(new Money(5)).type).toStrictEqual("success");
  expect(price.validate(new Money(0)).type).toStrictEqual("error");

  const result = price.validate({ amount: 5 });
  expect(result).toStrictEqual({
    type: "error",
    value: [
      {
        code: "type",
        message: "Value must be of type Money.",
        params: { expected: "Money", received: "object" },
        path: [],
      },
    ],
  });

  const isEqual: Equal<Infer<typeof price>, Money> = true;
  expect(isEqual).toStrictEqual(true);
});

test("instanceOf - built-in classes and custom message", () => {
  const link = xoe.instanceOf(URL, "Expected a URL object");

  expect(link.validate(new URL("https://example.com")).type).toStrictEqual(
    "success",
  );
  const result = link.validate("https://example.com");
  expect(result.type === "error" && toFieldErrors(result.value)).toStrictEqual({
    "": ["Expected a URL object"],
  });
  expect(
    xoe.instanceOf(Uint8Array).validate(new Uint8Array(2)).type,
  ).toStrictEqual("success");
});
