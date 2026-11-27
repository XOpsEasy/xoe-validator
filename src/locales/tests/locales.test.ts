import { expect, test } from "vitest";
import xoe, {
  enMessages,
  localizeIssues,
  rsRules,
  srMessages,
  toFieldErrors,
  Validator,
  XOEIssue,
} from "../../index.ts";

const file = (size: number, name = "a.txt", type = "text/plain") =>
  new File([new Uint8Array(size)], name, { type });

const issuesOf = (validator: Validator<unknown>, value: unknown) => {
  const result = validator.validate(value);
  return result.type === "error" ? result.value : [];
};

// A value that fails for every built-in issue code.
const failing: [Validator<unknown>, unknown][] = [
  [xoe.string(), undefined],
  [xoe.string(), 1],
  [xoe.literal("a"), "b"],
  [xoe.enum(["a", "b"]), "c"],
  [xoe.union([xoe.string(), xoe.number()]), true],
  [xoe.jsonSchema({ oneOf: [{ type: "number" }, { type: "integer" }] }), 1],
  [xoe.discriminatedUnion("kind", { a: xoe.object({}) }), { kind: "b" }],
  [
    xoe.object({
      password: xoe.string(),
      confirm: xoe.string().sameAs("password"),
    }),
    { password: "a", confirm: "b" },
  ],
  [xoe.string().transform((text) => JSON.parse(text) as unknown), "not json"],

  [xoe.string().minLength(3), "ab"],
  [xoe.string().maxLength(1), "ab"],
  [xoe.string().length(4), "ab"],
  [xoe.string().regexMatch(/^\d+$/), "ab"],
  [xoe.string().contains("@"), "ab"],
  [xoe.string().startsWith("x"), "ab"],
  [xoe.string().endsWith("x"), "ab"],
  [xoe.string().email(), "ab"],
  [xoe.string().url(), "ab"],
  [xoe.string().uuid(), "ab"],
  [xoe.jsonSchema({ type: "string", format: "date" }), "ab"],
  [xoe.jsonSchema({ type: "string", format: "date-time" }), "ab"],
  [xoe.string().ip(), "ab"],
  [xoe.string().digits(), "ab"],

  [xoe.number().minimum(5), 1],
  [xoe.number().maximum(0), 1],
  [xoe.jsonSchema({ type: "number", exclusiveMinimum: 1 }), 1],
  [xoe.jsonSchema({ type: "number", exclusiveMaximum: 1 }), 1],
  [xoe.number().between(2, 3), 1.5],
  [xoe.number().divisibleBy(2), 1],
  [xoe.number().integer(), 1.5],
  [xoe.number().positive(), 0],
  [xoe.number().nonNegative(), -1],
  [xoe.number().negative(), 0],
  [xoe.number().maxDecimals(2), 1.234],
  [xoe.number().safeInteger(), 2 ** 53],

  [xoe.boolean().isTrue(), false],

  [xoe.date().isBefore(new Date(2000, 0, 1)), new Date(2001, 0, 1)],
  [xoe.date().isAfter(new Date(2000, 0, 1)), new Date(1999, 0, 1)],
  [
    xoe.date().between(new Date(2000, 0, 1), new Date(2000, 11, 31)),
    new Date(2001, 0, 1),
  ],
  [xoe.date().inFuture({ now: () => 10 }), new Date(5)],
  [xoe.date().inPast({ now: () => 10 }), new Date(20)],
  [
    xoe.date().minAge(18, { now: () => new Date(2024, 0, 1) }),
    new Date(2010, 0, 1),
  ],
  [
    xoe.date().maxAge(65, { now: () => new Date(2024, 0, 1) }),
    new Date(1950, 0, 1),
  ],

  [xoe.array().minLength(2), [1]],
  [xoe.array().maxLength(1), [1, 2]],
  [xoe.array().length(2), [1]],
  [xoe.array().nonEmpty(), []],
  [xoe.array().unique(), [1, 1]],
  [xoe.array().uniqueBy("id"), [{ id: 1 }, { id: 1 }]],
  [xoe.tuple([xoe.number()]), [1, 2]],

  [xoe.object({ a: xoe.string() }).strict(), { a: "x", b: 1 }],
  [xoe.object({ a: xoe.string().optional() }).requireOne(), {}],
  [xoe.record(xoe.string().trim(), xoe.number()), { a: 1, " a": 2 }],

  [xoe.file().maxSize(1), file(2)],
  [xoe.file().minSize(5), file(2)],
  [xoe.file().accept(["image/*"]), file(2)],

  [xoe.jsonSchema(false), 1],

  [xoe.string().with(rsRules.jmbg()), "0101990710009"],
  [xoe.string().with(rsRules.pib()), "101134703"],
  [xoe.string().with(rsRules.companyNumber()), "17162544"],
];

const allIssues = failing.flatMap(([validator, value]) =>
  issuesOf(validator, value),
);
const codes = [...new Set(allIssues.map((issue) => issue.code))].sort();

test("locales - the test covers every built-in issue code", () => {
  // One code per case, and exactly the codes the catalogs have.
  expect(codes.length).toStrictEqual(failing.length);
  expect(codes).toStrictEqual(Object.keys(enMessages).sort());
});

test("locales - the default messages are the English catalog", () => {
  // Type issues of every validator, besides the cases above.
  const typeIssues = [
    xoe.string(),
    xoe.number(),
    xoe.boolean(),
    xoe.date(),
    xoe.array(),
    xoe.object({}),
    xoe.file(),
    xoe.tuple([xoe.string()]),
    xoe.record(xoe.string()),
    xoe.instanceOf(URL),
    xoe.discriminatedUnion("kind", { a: xoe.object({}) }),
    xoe.jsonSchema({ type: "null" }),
  ].flatMap((validator) => issuesOf(validator, Symbol("wrong type")));

  const issues = [...allIssues, ...typeIssues];
  expect(issues.map((issue) => issue.message)).toStrictEqual(
    localizeIssues(issues, enMessages).map((issue) => issue.message),
  );
});

test("locales - both catalogs translate every issue code", () => {
  for (const [name, catalog] of [
    ["en", enMessages],
    ["sr", srMessages],
  ] as const) {
    const missing = codes.filter((code) => !(code in catalog));
    expect(missing, `${name} misses codes`).toStrictEqual([]);
    for (const issue of localizeIssues(allIssues, catalog)) {
      expect(
        /\{\w+\}|undefined|NaN|\[object/.test(issue.message),
        `${name} ${issue.code}: ${issue.message}`,
      ).toStrictEqual(false);
    }
  }
  expect(Object.keys(srMessages).sort()).toStrictEqual(
    Object.keys(enMessages).sort(),
  );
});

test("locales - Serbian messages", () => {
  const form = xoe.object({
    name: xoe.string().minLength(3),
    bio: xoe.string().maxLength(21),
    code: xoe.string().length(2),
    tags: xoe.array(xoe.string()).minLength(5),
    price: xoe.number().minimum(0.5),
    born: xoe.date().isBefore(new Date(2000, 0, 15)),
    avatar: xoe.file().maxSize(1536),
    age: xoe.number(),
  });
  const messages = toFieldErrors(
    localizeIssues(
      issuesOf(form, {
        name: "ab",
        bio: "x".repeat(22),
        code: "abc",
        tags: ["a"],
        price: 0,
        born: new Date(2001, 0, 1, 14, 30),
        avatar: file(2000),
        age: "18",
      }),
      srMessages,
    ),
  );

  expect(messages).toStrictEqual({
    name: ["Tekst mora imati najmanje 3 karaktera."],
    bio: ["Tekst može imati najviše 21 karakter."],
    code: ["Tekst mora imati tačno 2 karaktera."],
    tags: ["Lista mora imati najmanje 5 stavki."],
    price: ["Vrednost mora biti najmanje 0,5."],
    born: ["Datum mora biti pre 15.01.2000."],
    avatar: ["Fajl može imati najviše 1,5 KB."],
    age: ["Vrednost mora biti broj."],
  });
});

test("locales - Serbian plural forms", () => {
  const message = (min: number) =>
    localizeIssues(issuesOf(xoe.array().minLength(min), []), srMessages)[0]
      .message;
  expect(
    [1, 2, 4, 5, 11, 12, 14, 21, 22, 25, 101, 112].map(message),
  ).toStrictEqual([
    "Lista mora imati najmanje 1 stavku.",
    "Lista mora imati najmanje 2 stavke.",
    "Lista mora imati najmanje 4 stavke.",
    "Lista mora imati najmanje 5 stavki.",
    "Lista mora imati najmanje 11 stavki.",
    "Lista mora imati najmanje 12 stavki.",
    "Lista mora imati najmanje 14 stavki.",
    "Lista mora imati najmanje 21 stavku.",
    "Lista mora imati najmanje 22 stavke.",
    "Lista mora imati najmanje 25 stavki.",
    "Lista mora imati najmanje 101 stavku.",
    "Lista mora imati najmanje 112 stavki.",
  ]);
});

test("locales - English messages", () => {
  const localized = (validator: Validator<unknown>, value: unknown) =>
    localizeIssues(issuesOf(validator, value), enMessages).map(
      (issue) => issue.message,
    );

  expect(localized(xoe.string().minLength(1), "")).toStrictEqual([
    "This field is required.",
  ]);
  expect(localized(xoe.string().length(1), "ab")).toStrictEqual([
    "Must be exactly 1 character long.",
  ]);
  expect(localized(xoe.array().maxLength(2), [1, 2, 3])).toStrictEqual([
    "Must have at most 2 items.",
  ]);
  expect(localized(xoe.enum(["a", 1]), "b")).toStrictEqual([
    'Value must be one of: "a", 1.',
  ]);
  expect(localized(xoe.instanceOf(URL), "x")).toStrictEqual([
    "Value must be of type URL.",
  ]);
  expect(
    localized(xoe.date().isAfter(new Date(2024, 4, 1, 9, 5)), new Date(0)),
  ).toStrictEqual(["Must be after 2024-05-01 09:05."]);
});

test("locales - custom messages and overrides", () => {
  const even = xoe.number().refine((n) => n % 2 === 0, "Mora biti paran.");
  // refine messages ("custom") are kept.
  expect(
    localizeIssues(issuesOf(even, 1), srMessages)[0].message,
  ).toStrictEqual("Mora biti paran.");

  // Catalogs are plain objects: extend or override entries.
  const messages = { ...srMessages, required: "Obavezno." };
  const issues: readonly XOEIssue[] = issuesOf(xoe.string(), "");
  expect(localizeIssues(issues, messages)[0].message).toStrictEqual(
    "Obavezno.",
  );
});

test("locales - messages you pass in are kept", () => {
  const localized = (validator: Validator<unknown>, value: unknown) =>
    localizeIssues(issuesOf(validator, value), srMessages).map(
      (issue) => issue.message,
    );

  // Rule and method arguments.
  expect(
    localized(xoe.string().minLength(3, "Ime je prekratko."), "ab"),
  ).toStrictEqual(["Ime je prekratko."]);
  expect(localized(xoe.string().required("Unesite ime."), "")).toStrictEqual([
    "Unesite ime.",
  ]);
  expect(
    localized(xoe.string().email().errorMessage("Loš email."), 1),
  ).toStrictEqual(["Loš email."]);
  expect(localized(xoe.enum(["a"], "Izaberite a."), "b")).toStrictEqual([
    "Izaberite a.",
  ]);
  expect(localized(xoe.instanceOf(URL, "Treba URL."), "x")).toStrictEqual([
    "Treba URL.",
  ]);
  expect(
    localized(xoe.union([xoe.string()], "Tekst ili ništa."), 1),
  ).toStrictEqual(["Tekst ili ništa."]);
  expect(
    localized(xoe.object({}).strict("Bez dodatnih polja."), { a: 1 }),
  ).toStrictEqual(["Bez dodatnih polja."]);
  expect(
    localized(
      xoe.object({
        a: xoe.string(),
        b: xoe.string().sameAs("a", "Ne slaže se."),
      }),
      { a: "x", b: "y" },
    ),
  ).toStrictEqual(["Ne slaže se."]);

  // Without a message, the same rules are translated.
  expect(localized(xoe.string().minLength(3), "ab")).toStrictEqual([
    "Tekst mora imati najmanje 3 karaktera.",
  ]);
  expect(localized(xoe.string().required(), "")).toStrictEqual([
    "Polje je obavezno.",
  ]);
});

test("locales - your own rules are translated by their code", () => {
  const range = xoe.number().refine((n) => n > 0, {
    code: "range.invalid",
    message: "Invalid range.",
  });
  const issues = issuesOf(range, -1);
  expect("customMessage" in issues[0]).toStrictEqual(false);
  expect(
    localizeIssues(issues, {
      ...srMessages,
      "range.invalid": "Opseg nije ispravan.",
    })[0].message,
  ).toStrictEqual("Opseg nije ispravan.");
  // Without an entry the rule's message stays.
  expect(localizeIssues(issues, srMessages)[0].message).toStrictEqual(
    "Invalid range.",
  );
});

test("locales - customMessage survives JSON (issues from an API)", () => {
  const issues = issuesOf(xoe.string().minLength(3, "Ime je prekratko."), "ab");
  const received = JSON.parse(JSON.stringify(issues));
  expect(localizeIssues(received, enMessages)[0].message).toStrictEqual(
    "Ime je prekratko.",
  );
});
