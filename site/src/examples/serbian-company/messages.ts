import {
  enMessages,
  srMessages,
  type XOEMessages,
} from "@x-ops-easy/xoe-validator";

export type Lang = "en" | "sr";

// Catalogs are plain objects. Keys are issue codes; "<field>:<code>" is a
// message for one field, and {placeholders} are filled from issue.params.
export const messages: Record<Lang, XOEMessages> = {
  en: enMessages,
  sr: {
    ...srMessages,
    "name:required": "Unesite naziv firme.",
    "employees:number.between":
      "Firma može imati od {min} do {max} zaposlenih.",
  },
};
