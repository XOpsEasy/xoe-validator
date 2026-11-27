import { expect, test } from "vitest";
import xoe, {
  localizeIssues,
  toFieldErrors,
  XOEMessages,
} from "../../index.ts";

const sr: XOEMessages = {
  required: "Polje je obavezno.",
  "string.minLength": "Unesite najmanje {min} karaktera.",
  "number.between": "Vrednost mora biti između {min} i {max}.",
  enum: "Izaberite jednu od opcija: {options}.",
  "pin:string.length": "PIN mora imati {length} cifre.",
  "string.email": (issue) => `Email "${issue.path.join(".")}" nije ispravan.`,
};

const form = xoe.object({
  name: xoe.string().minLength(3),
  age: xoe.number().between(18, 99),
  role: xoe.enum(["admin", "user"]),
  pin: xoe.string().length(4),
  code: xoe.string().length(2),
  email: xoe.string().email(),
});

test("localizeIssues - replaces messages by code with params", () => {
  const result = form.validate({
    name: "Jo",
    age: 120,
    role: "root",
    pin: "1",
    code: "abc",
    email: "nope",
  });

  expect(
    result.type === "error" && toFieldErrors(localizeIssues(result.value, sr)),
  ).toStrictEqual({
    name: ["Unesite najmanje 3 karaktera."],
    age: ["Vrednost mora biti između 18 i 99."],
    role: ["Izaberite jednu od opcija: admin, user."],
    pin: ["PIN mora imati 4 cifre."],
    code: ["Must be exactly 2 characters long."],
    email: ['Email "email" nije ispravan.'],
  });
});

test("localizeIssues - keeps codes, params and paths and does not mutate", () => {
  const result = xoe.object({ name: xoe.string() }).validate({});
  if (result.type !== "error") throw new Error("expected an error");

  const localized = localizeIssues(result.value, sr);

  expect(localized).toStrictEqual([
    {
      code: "required",
      message: "Polje je obavezno.",
      path: ["name"],
    },
  ]);
  expect(result.value[0].message).toStrictEqual("This field is required.");
});

test("localizeIssues - unknown placeholders are left as is", () => {
  const result = xoe.string().minLength(3).validate("a");
  if (result.type !== "error") throw new Error("expected an error");

  expect(
    localizeIssues(result.value, { "string.minLength": "{min} / {max}" })[0]
      .message,
  ).toStrictEqual("3 / {max}");
});

test("localizeIssues - ignores inherited catalog keys", () => {
  const result = xoe
    .string()
    .refine(() => false, "Custom", "toString")
    .validate("x");
  if (result.type !== "error") throw new Error("expected an error");

  expect(localizeIssues(result.value, {})[0].message).toStrictEqual("Custom");
});

test("localizeIssues - placeholders only use own params", () => {
  const result = xoe.string().minLength(3).validate("a");
  if (result.type !== "error") throw new Error("expected an error");

  expect(
    localizeIssues(result.value, { "string.minLength": "{min} {toString}" })[0]
      .message,
  ).toStrictEqual("3 {toString}");
});
