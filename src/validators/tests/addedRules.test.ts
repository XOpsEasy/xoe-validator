import { expect, test } from "vitest";
import xoe, {
  type Infer,
  type InferInput,
  type Validator,
} from "../../index.ts";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
// oxlint-disable-next-line no-unused-vars -- the type argument is the assertion
const expectType = <T extends true>() => {};

const codes = (validator: Validator<unknown>, value: unknown) => {
  const result = validator.validate(value);
  return result.type === "error" ? result.value.map((issue) => issue.code) : [];
};
const passes = (validator: Validator<unknown>, values: unknown[]) =>
  values.every((value) => validator.validate(value).type === "success");

test("string - toLowerCase and toUpperCase run before the rules", () => {
  const email = xoe.string().trim().toLowerCase().email();
  expect(email.validate("  Ana@Example.COM ")).toStrictEqual({
    type: "success",
    value: "ana@example.com",
  });
  expect(
    xoe.string().toUpperCase().startsWith("RS").validate("rs123"),
  ).toStrictEqual({
    type: "success",
    value: "RS123",
  });
});

test("string - date and dateTime", () => {
  expect(
    passes(xoe.string().date(), ["2024-02-29", "1999-12-31"]),
  ).toStrictEqual(true);
  expect(codes(xoe.string().date(), "2023-02-29")).toStrictEqual([
    "string.date",
  ]);
  expect(codes(xoe.string().date(), "2024-1-1")).toStrictEqual(["string.date"]);

  const at = xoe.string().dateTime();
  expect(
    passes(at, ["2024-05-01T10:00:00Z", "2024-05-01T10:00:00.123+02:00"]),
  ).toStrictEqual(true);
  // An offset is required unless local is set.
  expect(codes(at, "2024-05-01T10:00")).toStrictEqual(["string.dateTime"]);
  const local = xoe.string().dateTime({ local: true });
  expect(
    passes(local, ["2024-05-01T10:00", "2024-05-01T10:00:30"]),
  ).toStrictEqual(true);
  expect(codes(local, "2024-05-01T24:00")).toStrictEqual(["string.dateTime"]);
  expect(codes(local, "2024-02-30T10:00")).toStrictEqual(["string.dateTime"]);
});

test("string - ip and digits", () => {
  const ip = xoe.string().ip();
  expect(
    passes(ip, ["192.168.0.1", "::1", "2001:db8::8a2e:370:7334"]),
  ).toStrictEqual(true);
  expect(codes(ip, "256.0.0.1")).toStrictEqual(["string.ip"]);
  expect(codes(ip, "01.2.3.4")).toStrictEqual(["string.ip"]);
  expect(codes(ip, "fe80::1%eth0")).toStrictEqual(["string.ip"]);
  expect(codes(xoe.string().ip(4), "::1")).toStrictEqual(["string.ip"]);
  expect(codes(xoe.string().ip(6), "10.0.0.1")).toStrictEqual(["string.ip"]);
  expect(xoe.string().ip(6).validate("x")).toStrictEqual({
    type: "error",
    value: [
      {
        code: "string.ip",
        message: "Invalid IPv6 address.",
        params: { version: 6 },
        path: [],
      },
    ],
  });

  expect(passes(xoe.string().digits(), ["0", "0123"])).toStrictEqual(true);
  expect(codes(xoe.string().digits(), "12 34")).toStrictEqual([
    "string.digits",
  ]);
  expect(codes(xoe.string().digits(), "-1")).toStrictEqual(["string.digits"]);
});

test("number - greaterThan, lessThan, maxDecimals, safeInteger", () => {
  expect(passes(xoe.number().greaterThan(0), [0.001, 5])).toStrictEqual(true);
  expect(codes(xoe.number().greaterThan(0), 0)).toStrictEqual([
    "number.exclusiveMinimum",
  ]);
  expect(codes(xoe.number().lessThan(10), 10)).toStrictEqual([
    "number.exclusiveMaximum",
  ]);

  const amount = xoe.number().maxDecimals(2);
  // 0.29 % 0.01 isn't 0 in floating point; decimal places are counted.
  expect(passes(amount, [0.29, 10, -3.14, 1.1])).toStrictEqual(true);
  expect(codes(amount, 1.005)).toStrictEqual(["number.maxDecimals"]);
  expect(codes(xoe.number().maxDecimals(0), 1.5)).toStrictEqual([
    "number.maxDecimals",
  ]);
  expect(passes(xoe.number().maxDecimals(7), [1e-7])).toStrictEqual(true);

  const id = xoe.number().safeInteger();
  expect(passes(id, [Number.MAX_SAFE_INTEGER, -1, 0])).toStrictEqual(true);
  expect(codes(id, 2 ** 53)).toStrictEqual(["number.safeInteger"]);
  expect(codes(id, 1.5)).toStrictEqual(["number.safeInteger"]);
});

test("date - minAge and maxAge by the calendar", () => {
  const now = () => new Date(2024, 4, 10);
  const adult = xoe.date().minAge(18, { now });
  expect(
    passes(adult, [new Date(2006, 4, 10), new Date(1990, 0, 1)]),
  ).toStrictEqual(true);
  expect(codes(adult, new Date(2006, 4, 11))).toStrictEqual(["date.minAge"]);

  // Born on 29 February: the birthday is 1 March in other years.
  const leap = new Date(2004, 1, 29);
  expect(
    codes(xoe.date().minAge(18, { now: () => new Date(2022, 1, 28) }), leap),
  ).toStrictEqual(["date.minAge"]);
  expect(
    passes(xoe.date().minAge(18, { now: () => new Date(2022, 2, 1) }), [leap]),
  ).toStrictEqual(true);

  const retired = xoe.date().maxAge(65, { now });
  expect(passes(retired, [new Date(1959, 4, 10)])).toStrictEqual(true);
  expect(codes(retired, new Date(1958, 4, 9))).toStrictEqual(["date.maxAge"]);
  expect(
    xoe
      .date()
      .minAge(1, { now })
      .validate(new Date(2024, 0, 1)),
  ).toStrictEqual({
    type: "error",
    value: [
      {
        code: "date.minAge",
        message: "Must be at least 1 year old.",
        params: { years: 1 },
        path: [],
      },
    ],
  });
});

test("array - length", () => {
  expect(passes(xoe.array().length(2), [[1, 2]])).toStrictEqual(true);
  expect(codes(xoe.array().length(2), [1, 2, 3])).toStrictEqual([
    "array.length",
  ]);
});

test("object - requiredFields is the opposite of partial", () => {
  const user = xoe.object({
    name: xoe.string(),
    email: xoe.string().email(),
    bio: xoe.string().optional(),
  });
  const update = user.partial();
  const create = update.requiredFields("name", "email");

  expect(update.validate({}).type).toStrictEqual("success");
  expect(codes(create, {})).toStrictEqual(["required", "required"]);
  expect(create.validate({ name: "Ana", email: "a@b.io" }).type).toStrictEqual(
    "success",
  );
  // Fields that weren't listed keep their presence.
  expect(
    codes(user.requiredFields(), { name: "Ana", email: "a@b.io" }),
  ).toStrictEqual(["required"]);

  // Fields without required() (lazy) report empty values too.
  const lazy = xoe.object({ child: xoe.lazy(() => xoe.string()) });
  expect(codes(lazy.partial().requiredFields(), {})).toStrictEqual([
    "required",
  ]);

  const _types = () => {
    expectType<
      Equal<
        Infer<typeof create>,
        {
          name: string | null;
          email: string | null;
          bio?: string | null | undefined;
        }
      >
    >();
  };
});

test("object - keyof", () => {
  const user = xoe.object({ name: xoe.string(), age: xoe.number() });
  const sortBy = user.keyof();
  expect(sortBy.options).toStrictEqual(["name", "age"]);
  expect(sortBy.validate("age")).toStrictEqual({
    type: "success",
    value: "age",
  });
  expect(codes(sortBy, "email")).toStrictEqual(["enum"]);

  const _types = () => {
    expectType<Equal<Infer<typeof sortBy>, "name" | "age">>();
  };
});

test("object - catchall validates and keeps the other keys", () => {
  const settings = xoe
    .object({ theme: xoe.enum(["light", "dark"]) })
    .catchall(xoe.coerce.number());

  expect(
    settings.validate({ theme: "dark", fontSize: "14", zoom: 2 }),
  ).toStrictEqual({
    type: "success",
    value: { theme: "dark", fontSize: 14, zoom: 2 },
  });
  const result = settings.validate({ theme: "dark", fontSize: "big" });
  expect(
    result.type === "error" ? result.value.map((issue) => issue.path) : [],
  ).toStrictEqual([["fontSize"]]);

  const _types = () => {
    expectType<
      Equal<
        Infer<typeof settings>,
        {
          // Other keys are numbers; the index type includes the field types.
          [key: string]: number | "light" | "dark";
          theme: "light" | "dark";
        }
      >
    >();
  };
});

test("object - catchall with async validators", async () => {
  const taken = xoe
    .object({})
    .catchall(
      xoe.string().refineAsync((value) => Promise.resolve(value !== "x")),
    );
  expect(taken.isAsync).toStrictEqual(true);
  expect((await taken.validateAsync({ a: "y", b: "x" })).type).toStrictEqual(
    "error",
  );
});

test("enum - options, exclude and extract", () => {
  const role = xoe.enum(["admin", "editor", "viewer"]);
  expect(role.options).toStrictEqual(["admin", "editor", "viewer"]);
  // Members stay through chained calls.
  expect(role.optional().default("viewer").options).toStrictEqual([
    "admin",
    "editor",
    "viewer",
  ]);

  const staff = role.exclude(["viewer"]);
  expect(staff.options).toStrictEqual(["admin", "editor"]);
  expect(codes(staff, "viewer")).toStrictEqual(["enum"]);
  expect(role.extract(["viewer"]).validate("viewer").type).toStrictEqual(
    "success",
  );

  const _types = () => {
    expectType<Equal<Infer<typeof staff>, "admin" | "editor">>();
    expectType<
      Equal<Infer<ReturnType<typeof role.extract<"viewer">>>, "viewer">
    >();
    expectType<
      Equal<typeof role.options, readonly ("admin" | "editor" | "viewer")[]>
    >();
  };
});

test("meta and describe don't change validation or types", () => {
  const age = xoe
    .number()
    .integer()
    .meta({ title: "Age", examples: [30] })
    .describe("Age in years");
  expect(age.validate(30)).toStrictEqual({ type: "success", value: 30 });
  expect(codes(age, 1.5)).toStrictEqual(["number.integer"]);

  const _types = () => {
    expectType<Equal<Infer<typeof age>, number>>();
    expectType<Equal<InferInput<typeof age>, number>>();
  };
});
