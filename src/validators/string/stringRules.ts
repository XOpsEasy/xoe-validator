import { createRule, optionsOf, ruleMessage } from "../../core/rule.ts";
import { isExistingIsoDate } from "../../core/coerce.ts";
import * as en from "../../core/english.ts";

export const minLength = (min: number, message?: string) =>
  createRule<string>({
    code: "string.minLength",
    params: { min },
    check: (value) => value.length >= min,
    ...ruleMessage(message, en.stringMinLength(min)),
  });

export const maxLength = (max: number, message?: string) =>
  createRule<string>({
    code: "string.maxLength",
    params: { max },
    check: (value) => value.length <= max,
    ...ruleMessage(message, en.stringMaxLength(max)),
  });

export const regexMatch = (regex: RegExp, message?: string) => {
  // A private copy: test() on a global or sticky RegExp changes its lastIndex,
  // and the caller's RegExp must not change. Without "g" every call starts at
  // the beginning; a sticky ("y") pattern still has to match from index 0.
  const pattern = new RegExp(regex.source, regex.flags.replace("g", ""));

  return createRule<string>({
    code: "string.regexMatch",
    params: { pattern: regex.source, flags: pattern.flags },
    check: (value) => {
      pattern.lastIndex = 0;
      return pattern.test(value);
    },
    ...ruleMessage(message, en.regexMatch),
  });
};

export const contains = (substring: string, message?: string) =>
  createRule<string>({
    code: "string.contains",
    params: { substring },
    check: (value) => value.includes(substring),
    ...ruleMessage(message, en.contains(substring)),
  });

export const length = (exact: number, message?: string) =>
  createRule<string>({
    code: "string.length",
    params: { length: exact },
    check: (value) => value.length === exact,
    ...ruleMessage(message, en.stringLength(exact)),
  });

export const startsWith = (prefix: string, message?: string) =>
  createRule<string>({
    code: "string.startsWith",
    params: { prefix },
    check: (value) => value.startsWith(prefix),
    ...ruleMessage(message, en.startsWith(prefix)),
  });

export const endsWith = (suffix: string, message?: string) =>
  createRule<string>({
    code: "string.endsWith",
    params: { suffix },
    check: (value) => value.endsWith(suffix),
    ...ruleMessage(message, en.endsWith(suffix)),
  });

// Basic format check (something@domain.tld), not a full RFC 5322 parser.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export const email = (message?: string) =>
  createRule<string>({
    code: "string.email",
    check: (value) => EMAIL_PATTERN.test(value),
    ...ruleMessage(message, en.email),
  });

/**
 * The URL parser removes tabs and line breaks anywhere and control
 * characters and spaces at the ends, so such strings would pass unchanged
 * (and a "\r\n" could end up in a header or a log).
 */
// oxlint-disable-next-line no-control-regex -- control characters are what it finds
const UNSAFE_URL = /[\u0000-\u001f\u007f]|^\s|\s$/;

/** Whether `text` is an absolute URL with no characters the parser drops. */
export const parseUrl = (text: string): URL | undefined => {
  if (UNSAFE_URL.test(text)) return undefined;
  try {
    return new URL(text);
  } catch {
    return undefined;
  }
};

export const url = (
  protocols: string[] = ["http", "https"],
  message?: string,
) => {
  // A frozen copy: changing the list passed in can't change the rule.
  const allowed = Object.freeze([...protocols]);
  return createRule<string>({
    code: "string.url",
    params: { protocols: allowed },
    check: (value) => {
      const parsed = parseUrl(value);
      return (
        parsed !== undefined && allowed.includes(parsed.protocol.slice(0, -1))
      );
    },
    ...ruleMessage(message, en.url),
  });
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const uuid = (message?: string) =>
  createRule<string>({
    code: "string.uuid",
    check: (value) => UUID_PATTERN.test(value),
    ...ruleMessage(message, en.uuid),
  });

const ISO_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
// Hours 00-23, minutes and seconds 00-59 (Date.parse would accept 24:00).
const TIME = "([01]\\d|2[0-3]):[0-5]\\d";
const ISO_DATE_TIME = new RegExp(
  `^(\\d{4}-\\d{2}-\\d{2})[Tt ]${TIME}:[0-5]\\d(\\.\\d+)?([Zz]|[+-]${TIME})$`,
);
// <input type="datetime-local">: no offset, seconds optional.
const LOCAL_DATE_TIME = new RegExp(
  `^(\\d{4}-\\d{2}-\\d{2})T${TIME}(:[0-5]\\d(\\.\\d+)?)?$`,
);

/** An ISO 8601 date ("2024-05-01") that exists (not "2024-02-30"). */
export const date = (message?: string) =>
  createRule<string>({
    code: "string.date",
    check: (value) => ISO_DATE_ONLY.test(value) && isExistingIsoDate(value),
    ...ruleMessage(message, en.isoDate),
  });

export type DateTimeOptions = {
  message?: string;
  /**
   * Accept dates and times without an offset ("2024-05-01T10:00", as sent by
   * <input type="datetime-local">). By default an offset is required
   * ("Z" or "+02:00"), as in RFC 3339 and JSON Schema date-time.
   */
  local?: boolean;
};

/** An ISO 8601 / RFC 3339 date and time, e.g. "2024-05-01T10:00:00Z". */
export const dateTime = (options: string | DateTimeOptions = {}) => {
  const { message, local = false } = optionsOf(options);
  const pattern = local ? LOCAL_DATE_TIME : ISO_DATE_TIME;
  return createRule<string>({
    code: "string.dateTime",
    params: local ? { local } : undefined,
    check: (value) => {
      const match = pattern.exec(value);
      return (
        match !== null &&
        isExistingIsoDate(match[1]) &&
        !Number.isNaN(Date.parse(value))
      );
    },
    ...ruleMessage(message, en.isoDateTime),
  });
};

const IPV4_PART = "(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)";
const IPV4 = new RegExp(`^${IPV4_PART}(\\.${IPV4_PART}){3}$`);

const isIPv4 = (value: string) => IPV4.test(value);

// The URL parser validates IPv6 hosts, including "::" and embedded IPv4.
const isIPv6 = (value: string) => {
  if (!value.includes(":") || /[\s[\]/%@]/.test(value)) return false;
  try {
    new URL(`http://[${value}]`);
    return true;
  } catch {
    return false;
  }
};

/** An IP address: version 4, 6 or (by default) either. */
export const ip = (version?: 4 | 6, message?: string) =>
  createRule<string>({
    code: "string.ip",
    params: version === undefined ? undefined : { version },
    check: (value) =>
      version === 4
        ? isIPv4(value)
        : version === 6
          ? isIPv6(value)
          : isIPv4(value) || isIPv6(value),
    ...ruleMessage(message, en.ip(version)),
  });

/** Only the digits 0-9, e.g. a PIN or a postal code (no sign or spaces). */
export const digits = (message?: string) =>
  createRule<string>({
    code: "string.digits",
    check: (value) => /^\d+$/.test(value),
    ...ruleMessage(message, en.digits),
  });

export const ruleRegistry = /* @__PURE__ */ Object.freeze({
  minLength,
  maxLength,
  length,
  regexMatch,
  contains,
  startsWith,
  endsWith,
  email,
  url,
  uuid,
  date,
  dateTime,
  ip,
  digits,
});
