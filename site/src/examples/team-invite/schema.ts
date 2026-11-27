import xoe, { type Infer } from "@x-ops-easy/xoe-validator";

// One text field, many values. transform() splits the text, pipe() validates
// the result with another validator.
const emails = xoe
  .string()
  .transform((text) => text.split(/[\s,;]+/).filter(Boolean))
  .pipe(
    xoe
      .array(xoe.string().toLowerCase().email())
      .nonEmpty()
      .maxLength(5)
      .unique("An address is listed twice."),
  );

export const roleSchema = xoe.enum(["viewer", "editor", "admin"]);

export const inviteSchema = xoe.object({
  emails,
  role: roleSchema.default("viewer"),
  message: xoe.string().trim().maxLength(200).optional(),
});

export type Invite = Infer<typeof inviteSchema>;
// { emails: string[]; role: "viewer" | "editor" | "admin"; message?: string | null }
