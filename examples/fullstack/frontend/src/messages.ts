import { enMessages, srMessages, type XOEMessages } from "@x-ops-easy/xoe-validator";

export type Lang = "sr" | "en";

// The built-in codes come from the catalogs, our own codes from here.
export const messages: Record<Lang, XOEMessages> = {
  en: enMessages,
  sr: {
    ...srMessages,
    "username.taken": "Korisničko ime je zauzeto.",
    "order.tooMany": "Porudžbina može imati najviše 100 komada.",
  },
};
