import xoe, { type Infer, rsRules } from "@xopseasy/xoe-validator";

// The Serbian rules become methods of the string validator.
const string = xoe.string.extend(rsRules);

export const companySchema = xoe.object({
  name: xoe.string().trim().minLength(2),
  // The values are strings of digits: leading zeros matter.
  pib: string().trim().pib(), // tax ID, 9 digits, check digit by ISO 7064
  companyNumber: string().trim().companyNumber(), // matični broj, 8 digits
  director: string().trim().jmbg().optional(), // personal ID, 13 digits
  employees: xoe.coerce.number().integer().between(1, 250),
});

export type Company = Infer<typeof companySchema>;
