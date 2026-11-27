import xoe, { type Infer } from "@x-ops-easy/xoe-validator";

// Create a schema once, at module level, and reuse it.
export const loginSchema = xoe.object({
  // trim() and toLowerCase() run first: the rules see the cleaned value,
  // and it is what you get back.
  email: xoe.string().trim().toLowerCase().email(),
  // Every value is required unless it is optional() or has a default().
  password: xoe.string().minLength(8),
  remember: xoe.boolean().default(false),
});

export type Login = Infer<typeof loginSchema>;
// { email: string; password: string; remember: boolean }
