import xoe, { type Infer } from "@x-ops-easy/xoe-validator";

// Shared by the browser and the server: one definition, the same rules.
export const workspaceSchema = xoe.object({
  email: xoe.string().trim().toLowerCase().email(),
  workspace: xoe
    .string()
    .trim()
    .toLowerCase()
    .minLength(3)
    .maxLength(30)
    .regexMatch(
      /^[a-z0-9]+(-[a-z0-9]+)*$/,
      "Use lowercase letters, digits and dashes.",
    ),
  seats: xoe.coerce.number().integer().between(1, 50),
});

export type Workspace = Infer<typeof workspaceSchema>;
