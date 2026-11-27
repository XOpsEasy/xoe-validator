import xoe, { type Infer, type InferInput } from "@xopseasy/xoe-validator";

export const contactSchema = xoe.object({
  name: xoe.string().trim().minLength(2),
  email: xoe.string().trim().toLowerCase().email(),
  topic: xoe.enum(["sales", "support", "other"]),
  message: xoe.string().trim().minLength(20).maxLength(500),
  // A checkbox of react-hook-form holds a boolean.
  copy: xoe.boolean().default(false),
});

// The resolver types the form with the input and the submit handler with
// the output.
export type ContactInput = InferInput<typeof contactSchema>;
export type Contact = Infer<typeof contactSchema>;
