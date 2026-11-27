// Regression tests for the November 2026 code review findings on the core and
// forms (V1-V13).
import { expect, test } from "vitest";
import xoe, {
  enMessages,
  localizeIssues,
  srMessages,
  XOEValidationOutput,
} from "../../index.ts";
import { expectedSuccess } from "./helpers.ts";

const codes = <T>(result: XOEValidationOutput<T>) =>
  result.type === "error"
    ? result.value.map((issue) => `${issue.path.join(".")}:${issue.code}`)
    : [];

const messages = <T>(result: XOEValidationOutput<T>) =>
  result.type === "error" ? result.value.map((issue) => issue.message) : [];

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// These run in every time zone; run the suite with TZ=America/New_York too.
test("V1 - minAge reads a date-only birth date by its calendar day", () => {
  const now = () => new Date(2026, 10, 3, 12);
  const adult = xoe.coerce.date().minAge(18, { now });
  const young = xoe.coerce.date().maxAge(17, { now });

  // Turns 18 tomorrow (a date-only string is UTC midnight, like valueAsDate).
  expect(codes(adult.validate("2008-11-04"))).toStrictEqual([":date.minAge"]);
  expect(adult.validate("2008-11-03").type).toStrictEqual("success");
  expect(young.validate("2008-11-04").type).toStrictEqual("success");
  expect(codes(young.validate("2008-11-03"))).toStrictEqual([":date.maxAge"]);
  expect(
    xoe
      .date()
      .minAge(18, { now })
      .validate(new Date(Date.UTC(2008, 10, 4))).type,
  ).toStrictEqual("error");
});

test("V1 - minAge still reads local dates by their local day", () => {
  const now = () => new Date(2026, 10, 3, 12);
  const adult = xoe.date().minAge(18, { now });

  expect(adult.validate(new Date(2008, 10, 4)).type).toStrictEqual("error");
  expect(adult.validate(new Date(2008, 10, 3)).type).toStrictEqual("success");
  expect(adult.validate(new Date(2008, 10, 3, 23, 30)).type).toStrictEqual(
    "success",
  );
});

test("V2 - coerce.date rejects nonexistent dates with a space or t", () => {
  const date = xoe.coerce.date();

  expect(codes(date.validate("2024-02-30 10:00"))).toStrictEqual([":type"]);
  expect(codes(date.validate("2024-02-30t10:00"))).toStrictEqual([":type"]);
  expect(codes(date.validate("2023-02-29 00:00:00Z"))).toStrictEqual([":type"]);
  expect(date.validate("2024-02-29 10:00").type).toStrictEqual("success");
});

test("V3 - validateAsync validates holes of sparse arrays like validate", async () => {
  const sparse: string[] = [];
  sparse[1] = "a";
  const list = xoe.array(xoe.string());

  expect(codes(await list.validateAsync(sparse))).toStrictEqual(["0:required"]);
  expect(codes(list.validate(sparse))).toStrictEqual(["0:required"]);

  const holes: (string | undefined)[] = new Array(4);
  holes[1] = "a";
  holes[3] = "b";
  const optional = xoe.array(xoe.string().optional());
  expect(await optional.validateAsync(holes)).toStrictEqual(
    expectedSuccess([undefined, "a", undefined, "b"]),
  );

  const asyncItems = xoe.array(
    xoe
      .string()
      .optional()
      .refineAsync(() => Promise.resolve(true)),
  );
  expect(await asyncItems.validateAsync(sparse)).toStrictEqual(
    expectedSuccess([undefined, "a"]),
  );
});

test("V4 - a sync throw doesn't leave a sibling's rejection unhandled", async () => {
  const unhandled: unknown[] = [];
  const onUnhandled = (reason: unknown) => {
    unhandled.push(reason);
  };
  process.on("unhandledRejection", onUnhandled);
  try {
    const schema = xoe.object({
      email: xoe.string().refineAsync(async () => {
        await delay(10);
        throw new Error("network down");
      }),
      id: xoe.string().refine(() => {
        throw new Error("bug in a check");
      }),
    });

    await expect(
      schema.validateAsync({ email: "a@b.io", id: "1" }),
    ).rejects.toThrow("bug in a check");
    await delay(30);
    expect(unhandled).toStrictEqual([]);
  } finally {
    process.off("unhandledRejection", onUnhandled);
  }
});

test("V5 - queued async checks don't start after validateAsync rejected", async () => {
  let calls = 0;
  const list = xoe.array(
    xoe.string().refineAsync(async (value) => {
      calls++;
      await delay(2);
      if (value === "bad") throw new Error("down");
      return true;
    }),
  );

  await expect(
    list.validateAsync(["bad", ...Array(49).fill("ok")], {
      concurrency: 1,
    }),
  ).rejects.toThrow("down");
  await delay(60);
  expect(calls <= 2, `${calls} checks started`).toStrictEqual(true);
});

test("V5 - a caller's signal still aborts and checks still get it", async () => {
  const controller = new AbortController();
  const seen: boolean[] = [];
  const slow = xoe.string().refineAsync(async (_value, _data, { signal }) => {
    await delay(20);
    seen.push(signal?.aborted ?? false);
    return true;
  });

  const pending = slow.validateAsync("a", { signal: controller.signal });
  await delay(5);
  controller.abort(new Error("cancelled"));
  await expect(pending).rejects.toThrow("cancelled");
  await delay(30);
  expect(seen).toStrictEqual([true]);
});

test("V6 - catch().transform() transforms the fallback", () => {
  expect(
    xoe
      .string()
      .catch("fallback")
      .transform((text) => text.length)
      .validate(5),
  ).toStrictEqual(expectedSuccess(8));
  expect(
    xoe.coerce
      .number()
      .catch(1)
      .transform((n) => String(n * 2))
      .validate("abc"),
  ).toStrictEqual(expectedSuccess("2"));
});

test("V7 - nullable().required() rejects null", () => {
  expect(
    codes(xoe.string().nullable().required().validate(null)),
  ).toStrictEqual([":required"]);
  expect(xoe.string().nullable().required().validate("a").type).toStrictEqual(
    "success",
  );
});

test("V7 - requiredFields() keeps nullable fields nullable", () => {
  const form = xoe
    .object({
      a: xoe.string().nullable(),
      b: xoe.string().nullable().optional(),
    })
    .requiredFields();

  expect(form.validate({ a: null, b: null })).toStrictEqual(
    expectedSuccess({
      a: null,
      b: null,
    }),
  );
  expect(codes(form.validate({ a: null }))).toStrictEqual(["b:required"]);
});

test("V8 - nullable().pipe() passes null through", () => {
  const name = xoe.string().nullable().pipe(xoe.string().minLength(1));

  expect(name.validate(null)).toStrictEqual(expectedSuccess(null));
  expect(codes(name.validate(""))).toStrictEqual([":required"]);
  expect(
    codes(xoe.string().nullable().pipe(xoe.coerce.number()).validate("x")),
  ).toStrictEqual([":type"]);
});

test("V9 - requiredFields() leaves fields that are already required alone", () => {
  const base = xoe.object({
    transformed: xoe
      .string()
      .nullable()
      .transform((text) => text),
    json: xoe.jsonSchema({ type: ["string", "null"] }),
    jsonEmpty: xoe.jsonSchema({ type: "string" }),
    defaulted: xoe
      .string()
      .default("x")
      .transform((text) => text.toUpperCase()),
    named: xoe
      .string()
      .required("Enter your name")
      .transform((text) => text.trim()),
  });
  const input = {
    transformed: null,
    json: null,
    jsonEmpty: "",
    defaulted: undefined,
    named: "Ann",
  };

  expect(base.requiredFields().validate(input)).toStrictEqual(
    base.validate(input),
  );
  expect(
    messages(base.requiredFields().validate({ ...input, named: undefined })),
  ).toStrictEqual(["Enter your name"]);
});

test("V9 - requiredFields() undoes every partial() layer", () => {
  const node = xoe.object({
    child: xoe.lazy(() => xoe.string()),
    plain: xoe.string(),
  });

  expect(
    codes(node.partial().partial().requiredFields().validate({})),
  ).toStrictEqual(["child:required", "plain:required"]);
  expect(
    node.partial().partial().requiredFields().shape.child.isOptional,
  ).toStrictEqual(false);
});

test("V9 - partial() keeps the default of a transformed field", () => {
  const settings = xoe
    .object({
      s: xoe
        .string()
        .default("x")
        .transform((text) => text.toUpperCase()),
      n: xoe.number().transform((n) => n * 2),
    })
    .partial();

  expect(settings.validate({})).toStrictEqual(expectedSuccess({ s: "X" }));
  expect(settings.validate({ n: "" })).toStrictEqual(
    expectedSuccess({ s: "X", n: undefined }),
  );
});

test("V10 - discriminatedUnion options may be strict or catchall", () => {
  const payment = xoe.discriminatedUnion("type", {
    card: xoe.object({ number: xoe.string() }).strict(),
    cash: xoe.object({ amount: xoe.number() }).catchall(xoe.number()),
  });

  expect(payment.validate({ type: "card", number: "1" })).toStrictEqual(
    expectedSuccess({ type: "card", number: "1" }),
  );
  expect(
    codes(payment.validate({ type: "card", number: "1", x: 1 })),
  ).toStrictEqual([":object.strict"]);
  expect(payment.validate({ type: "cash", amount: 5, tip: 1 })).toStrictEqual(
    expectedSuccess({ type: "cash", amount: 5, tip: 1 }),
  );
});

test("V11 - discriminatedUnion keeps class and Map outputs of an option", () => {
  class Card {
    constructor(readonly number: string) {}
    last4() {
      return this.number.slice(-4);
    }
  }
  const union = xoe.discriminatedUnion("method", {
    card: xoe
      .object({ number: xoe.string() })
      .transform((value) => new Card(value.number)),
    map: xoe
      .object({ a: xoe.number() })
      .transform((value) => new Map([["a", value.a]])),
  });

  const card = union.validate({ method: "card", number: "4111" });
  expect(card.type === "success" && card.value instanceof Card).toStrictEqual(
    true,
  );
  const map = union.validate({ method: "map", a: 1 });
  expect(
    map.type === "success" && map.value instanceof Map && map.value.get("a"),
  ).toStrictEqual(1);
});

test("V12 - url() rejects control characters and surrounding spaces", () => {
  const url = xoe.string().url();
  const uri = xoe.jsonSchema({ type: "string", format: "uri" });

  for (const bad of [
    "https://example.com/\r\nSet-Cookie: a=b",
    " https://example.com",
    "https://example.com ",
    "\u0000https://example.com",
    "https://exa\nmple.com",
    "https://example.com/\t",
  ]) {
    expect(url.validate(bad).type, JSON.stringify(bad)).toStrictEqual("error");
    expect(uri.validate(bad).type, JSON.stringify(bad)).toStrictEqual("error");
  }
  expect(url.validate("https://example.com/a?b=c").type).toStrictEqual(
    "success",
  );
  expect(uri.validate("mailto:a@b.io").type).toStrictEqual("success");
});

test("V13 - date params are formatted after a JSON round trip", () => {
  const result = xoe
    .date()
    .isAfter(new Date(2024, 0, 15))
    .validate(new Date(2023, 0, 1));
  const issues = result.type === "error" ? result.value : [];
  const fromApi = JSON.parse(JSON.stringify(issues));

  expect(localizeIssues(fromApi, srMessages)[0].message).toStrictEqual(
    localizeIssues(issues, srMessages)[0].message,
  );
  expect(localizeIssues(fromApi, enMessages)[0].message).toStrictEqual(
    localizeIssues(issues, enMessages)[0].message,
  );
});
