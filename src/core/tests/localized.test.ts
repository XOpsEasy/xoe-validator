import { expect, test } from "vitest";
import xoe, {
  enMessages,
  type Infer,
  type InferInput,
  type IsAsync,
  localized,
  srMessages,
  toJsonSchema,
  type XOEMessages,
} from "../../index.ts";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
// oxlint-disable-next-line no-unused-vars -- the type argument is the assertion
const expectType = <T extends true>() => {};

const form = xoe.object({
  name: xoe.string().minLength(3),
  confirm: xoe.string().sameAs("name", "Names differ."),
});
const messagesOf = (result: { type: string; value: unknown }) =>
  result.type === "error"
    ? (result.value as { message: string }[]).map((issue) => issue.message)
    : [];

test("localized - validate returns translated messages", () => {
  const sr = localized(form, srMessages);
  expect(messagesOf(sr.validate({ name: "ab", confirm: "x" }))).toStrictEqual([
    "Tekst mora imati najmanje 3 karaktera.",
    "Names differ.", // a message passed in is kept
  ]);
  expect(sr.validate({ name: "Ana", confirm: "Ana" })).toStrictEqual({
    type: "success",
    value: { name: "Ana", confirm: "Ana" },
  });
});

test("localized - the Standard Schema interface (form resolvers)", async () => {
  const result = await localized(form, srMessages)["~standard"].validate({
    name: "ab",
    confirm: "ab",
  });
  expect(
    "issues" in result && result.issues?.map((issue) => issue.message),
  ).toStrictEqual(["Tekst mora imati najmanje 3 karaktera."]);
});

test("localized - validateAsync and async rules", async () => {
  const username = localized(
    xoe
      .string()
      .minLength(3)
      .refineAsync((value) => Promise.resolve(value !== "taken"), {
        code: "username.taken",
        message: "Taken.",
      }),
    { ...srMessages, "username.taken": "Zauzeto." },
  );
  expect(messagesOf(await username.validateAsync("taken"))).toStrictEqual([
    "Zauzeto.",
  ]);
  expect(messagesOf(await username.validateAsync("ab"))).toStrictEqual([
    "Tekst mora imati najmanje 3 karaktera.",
  ]);
});

test("localized - a function reads the catalog on every validation", () => {
  const catalogs: Record<string, XOEMessages> = {
    sr: srMessages,
    en: enMessages,
  };
  let lang = "sr";
  const name = localized(xoe.string().minLength(3), () => catalogs[lang]);

  expect(messagesOf(name.validate("ab"))).toStrictEqual([
    "Tekst mora imati najmanje 3 karaktera.",
  ]);
  lang = "en";
  expect(messagesOf(name.validate("ab"))).toStrictEqual([
    "Must be at least 3 characters long.",
  ]);
});

test("localized - same types, async marker and JSON Schema", () => {
  const sr = localized(form, srMessages);
  expect(toJsonSchema(sr)).toStrictEqual(toJsonSchema(form));
  expect(sr.isAsync).toStrictEqual(false);

  const _types = () => {
    expectType<Equal<Infer<typeof sr>, Infer<typeof form>>>();
    expectType<Equal<InferInput<typeof sr>, InferInput<typeof form>>>();
    expectType<Equal<IsAsync<typeof sr>, false>>();
    const slow = localized(
      xoe.string().refineAsync(() => Promise.resolve(true)),
      srMessages,
    );
    expectType<Equal<IsAsync<typeof slow>, true>>();
    // @ts-expect-error validate() stays a type error for async validators
    slow.validate("x");
  };
});
