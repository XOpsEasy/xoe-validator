import xoe from "@xopseasy/xoe-validator";

// meta() and describe() document a value. Validation doesn't read them;
// toJsonSchema() writes them to the schema.
export const createUserSchema = xoe
  .object({
    email: xoe.string().email().describe("Used to log in"),
    age: xoe
      .number()
      .integer()
      .minimum(18)
      .meta({ title: "Age", examples: [30] }),
    role: xoe.enum(["admin", "user"]).default("user"),
    website: xoe.string().url().nullable(),
    tags: xoe.array(xoe.string().minLength(2)).maxLength(5).unique().optional(),
    address: xoe.object({
      city: xoe.string().minLength(1),
      postalCode: xoe.string().digits().length(5),
    }),
  })
  .strict();
