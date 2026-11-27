import xoe, { type Infer } from "@x-ops-easy/xoe-validator";

const settingsSchema = xoe
  .object({
    theme: xoe.enum(["light", "dark"]),
    fontSize: xoe.number().integer().between(10, 24),
    plugins: xoe
      .array(xoe.string().minLength(1))
      .unique()
      .default(() => []),
  })
  // strict() reports keys that are not in the schema, e.g. a typo.
  .strict();

// A string that holds JSON: parse it, then validate what it holds. A
// transform that throws (JSON.parse of broken text) is reported as an issue
// with the code "transform", so invalid data never throws.
export const importSchema = xoe
  .string()
  .transform((text) => JSON.parse(text) as unknown)
  .pipe(settingsSchema);

export type Settings = Infer<typeof importSchema>;
