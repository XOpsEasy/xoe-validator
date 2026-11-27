import { createRule, ruleMessage } from "../../core/rule.ts";
import { isExistingIsoDate } from "../../core/coerce.ts";
import * as en from "../../core/english.ts";

// Rules for identifiers used in Serbia (country code RS). The values are
// strings of digits: leading zeros matter, so don't validate them as numbers.

const digitsOf = (value: string): number[] =>
  Array.from(value, (digit) => Number(digit));

/**
 * JMBG (jedinstveni matični broj građana), the Unique Master Citizen Number:
 * 13 digits DDMMYYYRRBBBK. The date of birth must exist (YYY is the year
 * without its first digit: 990 is 1990, 005 is 2005) and K is the check
 * digit: S = 7·A1 + 6·A2 + 5·A3 + 4·A4 + 3·A5 + 2·A6 + 7·A7 + ... + 2·A12,
 * m = S mod 11; m = 0 gives K = 0, m > 1 gives K = 11 - m, and m = 1 is
 * never issued.
 */
export const jmbg = (message?: string) =>
  createRule<string>({
    code: "rs.jmbg",
    check: (value) => {
      if (!/^\d{13}$/.test(value)) return false;
      const yyy = Number(value.slice(4, 7));
      const year = yyy < 800 ? 2000 + yyy : 1000 + yyy;
      const date = `${year}-${value.slice(2, 4)}-${value.slice(0, 2)}`;
      if (!isExistingIsoDate(date)) return false;

      const digits = digitsOf(value);
      const weights = [7, 6, 5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
      const sum = weights.reduce((total, w, i) => total + w * digits[i], 0);
      const m = sum % 11;
      if (m === 1) return false;
      return digits[12] === (m === 0 ? 0 : 11 - m);
    },
    ...ruleMessage(message, en.rsJmbg),
  });

/**
 * PIB (poreski identifikacioni broj), the tax identification number: 9
 * digits, the last one a check digit by ISO 7064 MOD 11,10.
 */
export const pib = (message?: string) =>
  createRule<string>({
    code: "rs.pib",
    check: (value) => {
      if (!/^\d{9}$/.test(value)) return false;
      const digits = digitsOf(value);
      let product = 10;
      for (let i = 0; i < 8; i++) {
        const sum = (product + digits[i]) % 10;
        product = ((sum === 0 ? 10 : sum) * 2) % 11;
      }
      return digits[8] === (11 - product) % 10;
    },
    ...ruleMessage(message, en.rsPib),
  });

/**
 * Matični broj (MB), the registration number of a company or sole trader: 8
 * digits, the last one a check digit by modulo 11 with the weights 2-7 from
 * the right (as in JMBG); a result of 10 or 11 gives 0.
 */
export const companyNumber = (message?: string) =>
  createRule<string>({
    code: "rs.companyNumber",
    check: (value) => {
      if (!/^\d{8}$/.test(value)) return false;
      const digits = digitsOf(value);
      let sum = 0;
      for (let i = 0; i < 7; i++) {
        // Weights 2, 3, ..., 7, 2 from the seventh digit to the first.
        sum += digits[6 - i] * (2 + (i % 6));
      }
      const check = 11 - (sum % 11);
      return digits[7] === (check > 9 ? 0 : check);
    },
    ...ruleMessage(message, en.rsCompanyNumber),
  });

export const ruleRegistry = /* @__PURE__ */ Object.freeze({
  jmbg,
  pib,
  companyNumber,
});
