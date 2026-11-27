import { expect, test } from "vitest";
import xoe, {
  localizeIssues,
  rsRules,
  srMessages,
  toJsonSchema,
  type Validator,
} from "../../../index.ts";

const valid = (validator: Validator<unknown>, values: string[]) =>
  values.filter((value) => validator.validate(value).type !== "success");
const invalid = (validator: Validator<unknown>, values: string[]) =>
  values.filter((value) => validator.validate(value).type === "success");

// The JMBGs are made up (no real person); the PIBs and company numbers are
// public numbers of companies and the python-stdnum example.

test("rs - jmbg", () => {
  const jmbg = xoe.string().with(rsRules.jmbg());
  expect(
    valid(jmbg, [
      "0101990710008", // 1 January 1990
      "1505005710004", // 15 May 2005: 005 is 2005
      "2902000715000", // 29 February 2000 (a leap year); remainder 0 gives K = 0
      "3112999711239", // 31 December 1999
    ]),
  ).toStrictEqual([]);
  expect(
    invalid(jmbg, [
      "0101990710009", // wrong check digit
      "0101990710130", // remainder 1: never issued, whatever the last digit
      "0101990710131",
      "3002990710000", // 30 February (valid check digit)
      "3104990710008", // 31 April
      "2902999710000", // 29 February 1999 (not a leap year)
      "0001990710003", // day 0
      "010199071000", // 12 digits
      "01019907100080", // 14 digits
      "0101990-71000", // not only digits
    ]),
  ).toStrictEqual([]);
});

test("rs - pib", () => {
  const pib = xoe.string().with(rsRules.pib());
  expect(valid(pib, ["101134702", "100002887", "104052135"])).toStrictEqual([]);
  expect(
    invalid(pib, [
      "101134703",
      "100002888",
      "10113470",
      "1011347020",
      "10113470a",
    ]),
  ).toStrictEqual([]);
});

test("rs - companyNumber", () => {
  const companyNumber = xoe.string().with(rsRules.companyNumber());
  expect(
    valid(companyNumber, [
      "17162543", // Telekom Srbija
      "20084693", // NIS
      "20080060", // the check digit result 10 becomes 0
    ]),
  ).toStrictEqual([]);
  expect(
    invalid(companyNumber, ["17162544", "20084690", "1716254", "171625430"]),
  ).toStrictEqual([]);
});

test("rs - as methods with extend, codes and messages", () => {
  const string = xoe.string.extend(rsRules);
  const company = xoe.object({
    pib: string().trim().pib(),
    companyNumber: string().trim().companyNumber(),
    director: string().jmbg().optional(),
  });

  expect(
    company.validate({ pib: " 101134702 ", companyNumber: "17162543" }),
  ).toStrictEqual({
    type: "success",
    value: { pib: "101134702", companyNumber: "17162543" },
  });

  const result = company.validate({
    pib: "101134703",
    companyNumber: "17162544",
    director: "0101990710009",
  });
  const issues = result.type === "error" ? result.value : [];
  expect(issues.map((issue) => issue.code)).toStrictEqual([
    "rs.pib",
    "rs.companyNumber",
    "rs.jmbg",
  ]);
  expect(issues.map((issue) => issue.message)).toStrictEqual([
    "Invalid PIB (tax identification number).",
    "Invalid company registration number (matični broj).",
    "Invalid JMBG (personal identification number).",
  ]);
  expect(
    localizeIssues(issues, srMessages).map((issue) => issue.message),
  ).toStrictEqual([
    "Neispravan PIB.",
    "Neispravan matični broj.",
    "Neispravan JMBG.",
  ]);
});

test("rs - toJsonSchema describes the length", () => {
  const { $schema: _, ...schema } = toJsonSchema(
    xoe.string().with(rsRules.jmbg()),
  );
  expect(schema).toStrictEqual({ type: "string", pattern: "^[0-9]{13}$" });
});
