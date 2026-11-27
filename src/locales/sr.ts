import { XOEMessages } from "../core/messages.ts";
import { XOEIssue } from "../core/validatorTypes.ts";
import {
  formatBytes,
  formatDate,
  formatList,
  formatNumber,
  formatValue,
  formatValues,
  paramsOf,
} from "../core/format.ts";
import { getOwn } from "../core/ownProperties.ts";

const num = (value: unknown) => formatNumber(value, ",");
const date = (value: unknown) =>
  formatDate(value, (day, month, year) => `${day}.${month}.${year}.`);
const bytes = (value: unknown) => formatBytes(value, ",");

/**
 * Serbian plural forms: 1, 21, 31 karakter; 2-4, 22-24 karaktera;
 * 5-20, 25-30 karaktera (with "few" and "other" as separate words when they
 * differ, e.g. stavka: 1 stavka, 2 stavke, 5 stavki).
 */
const count = (n: unknown, one: string, few: string, other: string) => {
  if (typeof n !== "number" || !Number.isInteger(n)) {
    return `${num(n)} ${other}`;
  }
  const mod10 = Math.abs(n) % 10;
  const mod100 = Math.abs(n) % 100;
  const word =
    mod10 === 1 && mod100 !== 11
      ? one
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? few
        : other;
  return `${n} ${word}`;
};

const characters = (n: unknown) =>
  count(n, "karakter", "karaktera", "karaktera");
const items = (n: unknown) => count(n, "stavku", "stavke", "stavki");
const years = (n: unknown) => count(n, "godinu", "godine", "godina");
const decimals = (n: unknown) => count(n, "decimalu", "decimale", "decimala");

const TYPES: Record<string, string> = {
  string: "tekst",
  number: "broj",
  boolean: "tačno ili netačno",
  date: "ispravan datum",
  array: "lista",
  tuple: "lista",
  object: "objekat",
  file: "fajl",
  null: "null",
};

const typeMessage = (issue: XOEIssue) => {
  const { expected } = paramsOf(issue);
  return `Vrednost mora biti ${
    getOwn(TYPES, String(expected)) ?? `tipa ${expected}`
  }.`;
};

/**
 * Serbian (Latin) messages for every issue code of the built-in validators,
 * for localizeIssues. Messages of your own rules (refine, superRefine, code
 * "custom") are kept: they're already written for your users.
 */
export const srMessages: XOEMessages = {
  required: "Polje je obavezno.",
  type: typeMessage,
  literal: (issue) =>
    `Vrednost mora biti ${formatValue(paramsOf(issue).expected)}.`,
  enum: (issue) =>
    `Vrednost mora biti jedna od: ${formatValues(paramsOf(issue).options)}.`,
  union: "Vrednost nije nijednog od dozvoljenih tipova.",
  oneOf: "Vrednost odgovara većem broju dozvoljenih tipova.",
  discriminator: (issue) =>
    `Neispravno polje ${paramsOf(issue).key}. Dozvoljeno: ${formatList(
      paramsOf(issue).options,
    )}.`,
  sameAs: "Vrednost mora biti ista kao u polju {field}.",
  transform: "Neispravna vrednost.",

  "string.minLength": (issue) =>
    `Tekst mora imati najmanje ${characters(paramsOf(issue).min)}.`,
  "string.maxLength": (issue) =>
    `Tekst može imati najviše ${characters(paramsOf(issue).max)}.`,
  "string.length": (issue) =>
    `Tekst mora imati tačno ${characters(paramsOf(issue).length)}.`,
  "string.regexMatch": "Vrednost nije u ispravnom formatu.",
  "string.contains": 'Vrednost mora da sadrži "{substring}".',
  "string.startsWith": 'Vrednost mora da počinje sa "{prefix}".',
  "string.endsWith": 'Vrednost mora da se završava sa "{suffix}".',
  "string.email": "Neispravna email adresa.",
  "string.url": "Neispravna veb adresa.",
  "string.uuid": "Neispravan UUID.",
  "string.date": "Neispravan datum.",
  "string.dateTime": "Neispravan datum i vreme.",
  "string.ip": (issue) =>
    paramsOf(issue).version === undefined
      ? "Neispravna IP adresa."
      : `Neispravna IPv${paramsOf(issue).version} adresa.`,
  "string.digits": "Vrednost sme da sadrži samo cifre.",

  "number.minimum": (issue) =>
    `Vrednost mora biti najmanje ${num(paramsOf(issue).min)}.`,
  "number.maximum": (issue) =>
    `Vrednost može biti najviše ${num(paramsOf(issue).max)}.`,
  "number.exclusiveMinimum": (issue) =>
    `Vrednost mora biti veća od ${num(paramsOf(issue).min)}.`,
  "number.exclusiveMaximum": (issue) =>
    `Vrednost mora biti manja od ${num(paramsOf(issue).max)}.`,
  "number.between": (issue) =>
    `Vrednost mora biti između ${num(paramsOf(issue).min)} i ${num(
      paramsOf(issue).max,
    )}.`,
  "number.divisibleBy": (issue) =>
    `Vrednost mora biti deljiva sa ${num(paramsOf(issue).divisor)}.`,
  "number.integer": "Vrednost mora biti ceo broj.",
  "number.positive": "Vrednost mora biti veća od 0.",
  "number.nonNegative": "Vrednost ne sme biti negativna.",
  "number.negative": "Vrednost mora biti manja od 0.",
  "number.maxDecimals": (issue) =>
    paramsOf(issue).max === 0
      ? "Vrednost mora biti ceo broj."
      : `Vrednost može imati najviše ${decimals(paramsOf(issue).max)}.`,
  "number.safeInteger":
    "Vrednost mora biti ceo broj između -9007199254740991 i 9007199254740991.",

  "boolean.isTrue": "Ovo polje mora biti označeno.",

  "date.isBefore": (issue) =>
    `Datum mora biti pre ${date(paramsOf(issue).date)}`,
  "date.isAfter": (issue) =>
    `Datum mora biti posle ${date(paramsOf(issue).date)}`,
  "date.between": (issue) =>
    `Datum mora biti između ${date(paramsOf(issue).min)} i ${date(
      paramsOf(issue).max,
    )}`,
  "date.inFuture": "Datum mora biti u budućnosti.",
  "date.inPast": "Datum mora biti u prošlosti.",
  "date.minAge": (issue) =>
    `Starost mora biti najmanje ${years(paramsOf(issue).years)}.`,
  "date.maxAge": (issue) =>
    `Starost može biti najviše ${years(paramsOf(issue).years)}.`,

  "array.minLength": (issue) =>
    `Lista mora imati najmanje ${items(paramsOf(issue).min)}.`,
  "array.maxLength": (issue) =>
    `Lista može imati najviše ${items(paramsOf(issue).max)}.`,
  "array.length": (issue) =>
    `Lista mora imati tačno ${items(paramsOf(issue).length)}.`,
  "array.nonEmpty": "Lista ne sme biti prazna.",
  "array.unique": "Stavke se ne smeju ponavljati.",
  "array.uniqueBy": (issue) =>
    paramsOf(issue).key === undefined
      ? "Stavke se ne smeju ponavljati."
      : `Vrednost polja "${paramsOf(issue).key}" se ne sme ponavljati.`,
  "tuple.length": (issue) =>
    `Lista može imati najviše ${items(paramsOf(issue).length)}.`,

  "object.strict": (issue) =>
    `Nepoznata polja nisu dozvoljena. Dozvoljena polja: ${formatList(
      paramsOf(issue).allowedKeys,
    )}.`,
  "object.requireOne": "Popunite bar jedno polje.",
  "record.duplicateKey": 'Ključ "{key}" se ponavlja.',

  "file.maxSize": (issue) =>
    `Fajl može imati najviše ${bytes(paramsOf(issue).max)}.`,
  "file.minSize": (issue) =>
    `Fajl mora imati najmanje ${bytes(paramsOf(issue).min)}.`,
  "file.accept": (issue) =>
    `Dozvoljeni tipovi fajla: ${formatList(paramsOf(issue).types)}.`,

  "jsonSchema.false": "Vrednost ovde nije dozvoljena.",

  "rs.jmbg": "Neispravan JMBG.",
  "rs.pib": "Neispravan PIB.",
  "rs.companyNumber": "Neispravan matični broj.",
};
