import xoe, { createRule, type Infer } from "@xopseasy/xoe-validator";

const passesLuhn = (digits: string) => {
  const sum = [...digits].reverse().reduce((total, char, index) => {
    const digit = Number(char) * (index % 2 === 1 ? 2 : 1);
    return total + (digit > 9 ? digit - 9 : digit);
  }, 0);
  return sum % 10 === 0;
};

// A rule of your own, with its own code. extend() makes it a method.
const cardNumber = (message?: string) =>
  createRule<string>({
    code: "card.number",
    check: (value) => value.length >= 13 && passesLuhn(value),
    message: message ?? "Enter a valid card number.",
  });
const string = xoe.string.extend({ cardNumber });

const notExpired = (expiry: string) => {
  const [month, year] = expiry.split("/").map(Number);
  // The first day of the next month; the regexMatch rule reports wrong formats.
  return Number.isNaN(year) || new Date(2000 + year, month, 1) > new Date();
};

const card = xoe.object({
  // "4242 4242 4242 4242": remove the spaces, then validate what is left.
  cardNumber: xoe
    .string()
    .transform((value) => value.replace(/\s/g, ""))
    .pipe(string().digits().cardNumber()),
  expiry: xoe
    .string()
    .trim()
    .regexMatch(/^(0[1-9]|1[0-2])\/\d{2}$/, "Use the format MM/YY.")
    .refine(notExpired, {
      code: "card.expired",
      message: "This card has expired.",
    }),
  cvc: xoe.string().digits().length(3),
});

const transfer = xoe.object({
  iban: xoe
    .string()
    .transform((value) => value.replace(/\s/g, "").toUpperCase())
    .pipe(
      xoe
        .string()
        .regexMatch(/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/, "Enter an IBAN."),
    ),
  accountHolder: xoe.string().trim().minLength(2),
});

const paypal = xoe.object({
  paypalEmail: xoe.string().trim().toLowerCase().email(),
});

export const paymentSchema = xoe.object({
  amount: xoe.coerce.number().positive().maxDecimals(2),
  // The value of "method" picks the shape. Only that shape is validated, and
  // the fields of the other methods are removed from the output.
  payment: xoe.discriminatedUnion("method", { card, transfer, paypal }),
});

export type Payment = Infer<typeof paymentSchema>;
// payment: { method: "card"; cardNumber: string; ... } | { method: "transfer"; ... } | ...
