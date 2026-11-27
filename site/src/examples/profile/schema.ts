import xoe, { type Infer } from "@xopseasy/xoe-validator";

// undefined, null and "" count as empty. An empty input is "", so a form
// needs no special handling for fields the user left blank.
export const profileSchema = xoe.object({
  // Required: "" (or only spaces, because of trim) reports "required".
  displayName: xoe.string().trim().minLength(2).maxLength(40),

  // optional(): empty passes and is left out; a value must still be a URL.
  website: xoe.string().trim().url().optional(),
  bio: xoe.string().trim().maxLength(160).optional(),
  yearsOfExperience: xoe.coerce.number().integer().between(0, 60).optional(),

  // default(): empty becomes the default, so the output always has it.
  language: xoe.enum(["en", "sr", "de"]).default("en"),

  // transform() maps the valid value: "@Ana_M" and "ana_m" give "ana_m".
  handle: xoe
    .string()
    .trim()
    .regexMatch(/^@?\w{2,15}$/, "2 to 15 letters, digits or _.")
    .transform((value) => value.replace(/^@/, "").toLowerCase()),
});

export type Profile = Infer<typeof profileSchema>;
// { displayName: string; website?: string | null; ...; language: "en" | "sr" | "de"; handle: string }
