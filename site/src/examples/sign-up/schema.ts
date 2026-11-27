import xoe, { type Infer, type InferInput } from "@x-ops-easy/xoe-validator";

const taken = ["marko", "ana", "admin"];

/** Stands in for a request to your API; it takes 600 ms. */
export const isUsernameFree = (username: string, signal?: AbortSignal) =>
  new Promise<boolean>((resolve, reject) => {
    const timer = setTimeout(() => resolve(!taken.includes(username)), 600);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(signal.reason);
    });
  });

export const signUpSchema = xoe.object({
  username: xoe
    .string()
    .trim()
    .toLowerCase()
    .minLength(3)
    .maxLength(20)
    .regexMatch(/^[a-z0-9_]+$/, "Use only letters, digits and _.")
    // Async rules run only when the other rules of the value passed, so a
    // username that is too short never reaches the API.
    .refineAsync(
      (username, _data, { signal }) => isUsernameFree(username, signal),
      { code: "username.taken", message: "This username is taken." },
    ),
  email: xoe.string().trim().toLowerCase().email(),
  // All rules are checked, so a short password without a digit reports both.
  password: xoe
    .string()
    .minLength(8)
    .regexMatch(/\d/, "Add at least one digit."),
  confirmPassword: xoe
    .string()
    .sameAs("password", "The passwords do not match."),
  // <input type="date"> gives a string; coerce.date() makes it a Date.
  birthDate: xoe.coerce.date().minAge(18),
  plan: xoe.enum(["free", "team", "business"]).default("free"),
  terms: xoe.boolean().isTrue("Accept the terms to continue."),
});

export type SignUp = Infer<typeof signUpSchema>; // birthDate: Date
export type SignUpInput = InferInput<typeof signUpSchema>; // birthDate: string | number | Date
