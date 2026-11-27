// Schemas shared by the frontend and the backend: one definition, the same
// rules and messages on both sides. Only what differs (how a username is
// checked) is passed in.
import xoe, { type Infer, type InferInput, rsRules } from "@xopseasy/xoe-validator";

const string = xoe.string.extend(rsRules);

/** Checks that a username is free: the API on the frontend, the database on the backend. */
export type IsUsernameFree = (
  username: string,
  signal?: AbortSignal,
) => Promise<boolean>;

export const signUpSchema = (isUsernameFree: IsUsernameFree) =>
  xoe.object({
    username: xoe.string().trim().toLowerCase().minLength(3).maxLength(20)
      .regexMatch(/^[a-z0-9_]+$/, "Only letters, digits and _.")
      .refineAsync(
        (username, _data, { signal }) => isUsernameFree(username, signal),
        { code: "username.taken", message: "This username is taken." },
      ),
    email: xoe.string().trim().toLowerCase().email(),
    password: xoe.string().minLength(8),
    confirmPassword: xoe.string().sameAs("password", "Passwords do not match."),
    birthDate: xoe.coerce.date().minAge(18),
    role: xoe.enum(["user", "admin"]).default("user"),
    newsletter: xoe.coerce.boolean().default(false),
  });

export type SignUp = Infer<ReturnType<typeof signUpSchema>>;
export type SignUpForm = InferInput<ReturnType<typeof signUpSchema>>;

export const companySchema = xoe.object({
  name: xoe.string().trim().minLength(2).describe("The registered name"),
  pib: string().trim().pib().describe("PIB, the tax identification number"),
  companyNumber: string().trim().companyNumber()
    .describe("Matični broj, the registration number"),
  director: string().trim().jmbg().optional(),
});
export type Company = Infer<typeof companySchema>;

export const orderSchema = xoe.object({
  customer: xoe.string().trim().email(),
  items: xoe.array(
    xoe.object({
      sku: xoe.string().trim().toUpperCase().regexMatch(/^[A-Z]{3}-\d{3}$/),
      quantity: xoe.number().integer().positive(),
      price: xoe.number().positive().maxDecimals(2),
    }),
  ).nonEmpty().maxLength(50),
  note: xoe.string().trim().maxLength(200).optional(),
}).refine(
  (order) => order.items.reduce((sum, item) => sum + item.quantity, 0) <= 100,
  { code: "order.tooMany", message: "At most 100 items per order.", path: ["items"] },
);
export type Order = Infer<typeof orderSchema>;

/** Query parameters are strings and often wrong: catch() falls back. */
export const userListQuery = xoe.object({
  page: xoe.coerce.number().integer().minimum(1).catch(1),
  pageSize: xoe.coerce.number().integer().between(1, 100).catch(20),
  sort: xoe.enum(["name", "createdAt"]).catch("createdAt"),
  q: xoe.string().trim().maxLength(50).optional(),
});

/** A bulk import, e.g. from a CSV file. */
export const importSchema = xoe.array(
  xoe.object({
    email: xoe.string().trim().toLowerCase().email(),
    name: xoe.string().trim().minLength(2),
    age: xoe.coerce.number().integer().between(0, 150),
  }),
).maxLength(5000);
