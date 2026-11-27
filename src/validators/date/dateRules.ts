import { createRule, optionsOf, ruleMessage } from "../../core/rule.ts";
import * as en from "../../core/english.ts";

// The rules keep their own copy of the dates passed in, so changing such a
// Date later (setFullYear, ...) can't change the rule or its message. A
// timestamp (from JavaScript callers) works too.
const copyOf = (date: Date | number) => new Date(+date);

export const isBefore = (maxDate: Date, message?: string) => {
  const max = copyOf(maxDate);
  return createRule<Date>({
    code: "date.isBefore",
    params: { date: max },
    check: (value) => value < max,
    ...ruleMessage(message, en.isBefore(max)),
  });
};

export const isAfter = (minDate: Date, message?: string) => {
  const min = copyOf(minDate);
  return createRule<Date>({
    code: "date.isAfter",
    params: { date: min },
    check: (value) => value > min,
    ...ruleMessage(message, en.isAfter(min)),
  });
};

export const between = (minDate: Date, maxDate: Date, message?: string) => {
  const min = copyOf(minDate);
  const max = copyOf(maxDate);
  return createRule<Date>({
    code: "date.between",
    params: { min, max },
    check: (value) => value >= min && value <= max,
    ...ruleMessage(message, en.dateBetween(min, max)),
  });
};

export type RelativeDateOptions = {
  message?: string;
  /**
   * The current time, read on every validation (default: the system clock).
   * Pass a fixed clock to make validation deterministic, e.g. in tests.
   */
  now?: () => Date | number;
};

const systemClock = () => Date.now();

/** A rule that compares the date with "now", read on every validation. */
const clockRule = (
  code: string,
  defaultMessage: string,
  check: (value: Date, now: Date) => boolean,
  options: string | RelativeDateOptions | undefined,
  params?: Record<string, unknown>,
) => {
  const { message, now = systemClock } = optionsOf(options);
  return createRule<Date>({
    code,
    params,
    check: (value) => check(value, new Date(now())),
    ...ruleMessage(message, defaultMessage),
  });
};

/** The date is after "now", read on every validation (not when the rule is created). */
export const inFuture = (options?: string | RelativeDateOptions) =>
  clockRule(
    "date.inFuture",
    en.inFuture,
    (value, now) => value.getTime() > now.getTime(),
    options,
  );

/** The date is before "now", read on every validation. */
export const inPast = (options?: string | RelativeDateOptions) =>
  clockRule(
    "date.inPast",
    en.inPast,
    (value, now) => value.getTime() < now.getTime(),
    options,
  );

const isUtcMidnight = (date: Date) =>
  date.getUTCHours() === 0 &&
  date.getUTCMinutes() === 0 &&
  date.getUTCSeconds() === 0 &&
  date.getUTCMilliseconds() === 0;

/**
 * The calendar day of a birth date. A date at UTC midnight is a date
 * without a time ("2008-11-04" through coerce.date, valueAsDate of
 * <input type="date">), so its UTC day counts; west of UTC its local day
 * would be the day before. Other dates count by their local day.
 */
const birthday = (birth: Date) =>
  isUtcMidnight(birth)
    ? [birth.getUTCFullYear(), birth.getUTCMonth(), birth.getUTCDate()]
    : [birth.getFullYear(), birth.getMonth(), birth.getDate()];

/** Full years between a birth date and `now`, by the calendar. */
const ageAt = (birth: Date, now: Date): number => {
  const [year, month, day] = birthday(birth);
  const years = now.getFullYear() - year;
  const hadBirthday =
    now.getMonth() > month ||
    (now.getMonth() === month && now.getDate() >= day);
  return hadBirthday ? years : years - 1;
};

/**
 * The date (a birth date) is at least `years` ago, by the calendar in the
 * runtime's time zone; read on every validation. Someone born on 29 February
 * has their birthday on 1 March in other years.
 */
export const minAge = (years: number, options?: string | RelativeDateOptions) =>
  clockRule(
    "date.minAge",
    en.minAge(years),
    (value, now) => ageAt(value, now) >= years,
    options,
    { years },
  );

/** The date (a birth date) is at most `years` ago (see minAge). */
export const maxAge = (years: number, options?: string | RelativeDateOptions) =>
  clockRule(
    "date.maxAge",
    en.maxAge(years),
    (value, now) => ageAt(value, now) <= years,
    options,
    { years },
  );

export const ruleRegistry = /* @__PURE__ */ Object.freeze({
  isBefore,
  isAfter,
  between,
  inFuture,
  inPast,
  minAge,
  maxAge,
});
