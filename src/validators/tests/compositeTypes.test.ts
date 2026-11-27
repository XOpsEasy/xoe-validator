import { expect, test } from "vitest";
import xoe, {
  Infer,
  toFieldErrors,
  Validator,
  XOEValidationOutput,
} from "../../index.ts";
import { expectedSuccess } from "../../core/tests/helpers.ts";

// Untyped expected success, so literal outputs ("admin") can be compared.
const ok = (value: unknown): XOEValidationOutput<unknown> =>
  expectedSuccess(value);

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;

const fieldErrors = <T>(result: XOEValidationOutput<T>) =>
  result.type === "error" ? toFieldErrors(result.value) : {};

test("literal - accepts exactly one value", () => {
  const admin = xoe.literal("admin");

  expect(admin.validate("admin")).toStrictEqual(ok("admin"));
  expect(admin.validate("user")).toStrictEqual({
    type: "error",
    value: [
      {
        code: "literal",
        message: 'Value must be "admin".',
        params: { expected: "admin" },
        path: [],
      },
    ],
  });
  expect(xoe.literal(42).validate(42).type).toStrictEqual("success");
  expect(xoe.literal(true).validate(false).type).toStrictEqual("error");

  const isEqual: Equal<Infer<typeof admin>, "admin"> = true;
  expect(isEqual).toStrictEqual(true);
});

test("enum - accepts one of the values", () => {
  const role = xoe.enum(["admin", "user", "guest"]);

  expect(role.validate("user")).toStrictEqual(ok("user"));
  expect(role.validate("root")).toStrictEqual({
    type: "error",
    value: [
      {
        code: "enum",
        message: 'Value must be one of: "admin", "user", "guest".',
        params: { options: ["admin", "user", "guest"] },
        path: [],
      },
    ],
  });
  expect(role.optional().default("guest").validate(undefined)).toStrictEqual(
    ok("guest"),
  );

  const isEqual: Equal<Infer<typeof role>, "admin" | "user" | "guest"> = true;
  expect(isEqual).toStrictEqual(true);
});

test("enum - custom message", () => {
  expect(
    fieldErrors(xoe.enum([1, 2, 3], "Pick a size").validate(4)),
  ).toStrictEqual({ "": ["Pick a size"] });
});

test("union - first matching validator wins", () => {
  const id = xoe.union([xoe.number().integer(), xoe.string().uuid()]);

  expect(id.validate(7)).toStrictEqual(ok(7));
  expect(
    id.validate("123e4567-e89b-12d3-a456-426614174000").type,
  ).toStrictEqual("success");
  expect(id.validate("abc")).toStrictEqual({
    type: "error",
    value: [
      {
        code: "union",
        message: "Value doesn't match any of the allowed types.",
        path: [],
      },
    ],
  });

  const isEqual: Equal<Infer<typeof id>, number | string> = true;
  expect(isEqual).toStrictEqual(true);
});

test("union - returns the output of the matching validator", () => {
  const value = xoe.union([
    xoe.coerce.number(),
    xoe.string().transform((text) => text.toUpperCase()),
  ]);

  expect(value.validate("12")).toStrictEqual(ok(12));
  expect(value.validate("abc")).toStrictEqual(ok("ABC"));
});

test("union - required and optional", () => {
  const value = xoe.union([xoe.string(), xoe.number()]);

  expect(fieldErrors(value.validate(undefined))).toStrictEqual({
    "": ["This field is required."],
  });
  expect(value.optional().validate(undefined)).toStrictEqual(ok(undefined));
});

test("union - async options", async () => {
  const value = xoe.union([
    xoe.string().refineAsync((text) => Promise.resolve(text === "ok")),
    xoe.number(),
  ]);

  expect(value.isAsync).toStrictEqual(true);
  expect(await value.validateAsync("ok")).toStrictEqual(ok("ok"));
  expect(await value.validateAsync(1)).toStrictEqual(ok(1));
  expect((await value.validateAsync("no")).type).toStrictEqual("error");
});

const payment = xoe.discriminatedUnion("method", {
  card: xoe.object({
    cardNumber: xoe.string().length(16),
    cvc: xoe.string().length(3),
  }),
  paypal: xoe.object({ email: xoe.string().email() }),
});

test("discriminatedUnion - validates the selected shape", () => {
  expect(
    payment.validate({ method: "paypal", email: "john@mail.com", extra: 1 }),
  ).toStrictEqual(ok({ method: "paypal", email: "john@mail.com" }));
  expect(
    fieldErrors(payment.validate({ method: "card", cardNumber: "123" })),
  ).toStrictEqual({
    cardNumber: ["Must be exactly 16 characters long."],
    cvc: ["This field is required."],
  });
});

test("discriminatedUnion - missing or unknown discriminator", () => {
  expect(
    fieldErrors(payment.validate({ email: "john@mail.com" })),
  ).toStrictEqual({
    method: ["This field is required."],
  });
  expect(payment.validate({ method: "cash" })).toStrictEqual({
    type: "error",
    value: [
      {
        code: "discriminator",
        message: "Invalid method. Expected one of: card, paypal.",
        params: { key: "method", options: ["card", "paypal"] },
        path: ["method"],
      },
    ],
  });
  expect(fieldErrors(payment.validate("card"))).toStrictEqual({
    "": ["Value must be an object."],
  });
});

test("discriminatedUnion - nested paths and inferred type", () => {
  const order = xoe.object({ payment });

  expect(
    fieldErrors(order.validate({ payment: { method: "paypal", email: "x" } })),
  ).toStrictEqual({ "payment.email": ["Invalid email address."] });

  const isEqual: Equal<
    Infer<typeof payment>,
    | { method: "card"; cardNumber: string; cvc: string }
    | { method: "paypal"; email: string }
  > = true;
  expect(isEqual).toStrictEqual(true);
});

type Category = { name: string; children: Category[] };

const category: Validator<Category> = xoe.object({
  name: xoe.string().minLength(2),
  children: xoe.array(xoe.lazy(() => category)),
});

test("lazy - recursive schema", () => {
  const tree = {
    name: "root",
    children: [
      { name: "a", children: [] },
      { name: "bb", children: [{ name: "c", children: [] }] },
    ],
  };

  expect(fieldErrors(category.validate(tree))).toStrictEqual({
    "children.0.name": ["Must be at least 2 characters long."],
    "children.1.children.0.name": ["Must be at least 2 characters long."],
  });
  expect(
    category.validate({
      name: "root",
      children: [{ name: "ab", children: [] }],
    }).type,
  ).toStrictEqual("success");
});

test("lazy - isAsync terminates and detects async rules in recursion", async () => {
  type Comment = { text: string; replies: Comment[] };
  const comment: Validator<Comment> = xoe.object({
    text: xoe
      .string()
      .refineAsync((text) => Promise.resolve(!text.includes("spam"))),
    replies: xoe.array(xoe.lazy(() => comment)),
  });

  expect(category.isAsync).toStrictEqual(false);
  expect(comment.isAsync).toStrictEqual(true);
  expect(
    fieldErrors(
      await comment.validateAsync({
        text: "hi",
        replies: [{ text: "spam!", replies: [] }],
      }),
    ),
  ).toStrictEqual({ "replies.0.text": ["Validation failed."] });
});

test("record - validates every value", () => {
  const scores = xoe.record(xoe.number().between(0, 100));

  expect(scores.validate({ ana: 90, bob: 75 })).toStrictEqual(
    ok({ ana: 90, bob: 75 }),
  );
  expect(
    fieldErrors(scores.validate({ ana: 90, bob: 120, eve: "x" })),
  ).toStrictEqual({
    bob: ["Must be between 0 and 100."],
    eve: ["Value must be a number."],
  });

  const isEqual: Equal<Infer<typeof scores>, Record<string, number>> = true;
  expect(isEqual).toStrictEqual(true);
});

test("record - validates keys", () => {
  const prices = xoe.record(
    xoe.enum(["eur", "usd"]),
    xoe.coerce.number().positive(),
  );

  expect(prices.validate({ eur: "10" })).toStrictEqual(ok({ eur: 10 }));
  expect(prices.validate({ rsd: 1000 })).toStrictEqual({
    type: "error",
    value: [
      {
        code: "enum",
        message: 'Value must be one of: "eur", "usd".',
        params: { options: ["eur", "usd"], recordKey: "rsd" },
        path: ["rsd"],
      },
    ],
  });

  const isEqual: Equal<
    Infer<typeof prices>,
    Partial<Record<"eur" | "usd", number>>
  > = true;
  expect(isEqual).toStrictEqual(true);
});

test("composite types inside an object", () => {
  const user = xoe.object({
    role: xoe.enum(["admin", "user"]).default("user"),
    status: xoe.union([xoe.literal("active"), xoe.literal("blocked")]),
    settings: xoe.record(xoe.coerce.boolean()).optional(),
  });

  expect(
    user.validate({ status: "active", settings: { darkMode: "on" } }),
  ).toStrictEqual(
    ok({
      role: "user",
      status: "active",
      settings: { darkMode: true },
    }),
  );

  const isEqual: Equal<
    Infer<typeof user>,
    {
      role: "admin" | "user";
      status: "active" | "blocked";
      settings?: Record<string, boolean> | null | undefined;
    }
  > = true;
  expect(isEqual).toStrictEqual(true);
});

test("union - errorMessage replaces the union message", () => {
  expect(
    fieldErrors(
      xoe
        .union([xoe.string(), xoe.number()])
        .errorMessage("Text or number")
        .validate(true),
    ),
  ).toStrictEqual({ "": ["Text or number"] });
});

test("discriminatedUnion - required and errorMessage messages", () => {
  expect(
    fieldErrors(payment.required("Choose a payment method").validate({})),
  ).toStrictEqual({ method: ["Choose a payment method"] });
  expect(
    fieldErrors(
      payment.errorMessage("Invalid payment").validate({ method: "cash" }),
    ),
  ).toStrictEqual({ method: ["Invalid payment"] });
});
