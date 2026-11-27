import xoe, { type Infer, rsRules } from "@x-ops-easy/xoe-validator";

const string = xoe.string.extend(rsRules);

const personal = xoe.object({
  firstName: xoe.string().trim().minLength(2),
  email: xoe.string().trim().toLowerCase().email(),
  birthDate: xoe.coerce.date().minAge(18),
});

// A branch: a person and a company answer different questions.
const applicant = xoe.discriminatedUnion("type", {
  person: xoe.object({ jmbg: string().trim().jmbg() }),
  company: xoe.object({
    companyName: xoe.string().trim().minLength(2),
    pib: string().trim().pib(),
  }),
});

// A follow-up question: the amount is asked only when there are loans.
const loans = xoe
  .object({
    hasLoans: xoe.boolean().default(false),
    loanAmount: xoe.coerce.number().positive().optional(),
  })
  .refine((value) => !value.hasLoans || value.loanAmount != null, {
    code: "required",
    message: "Enter the amount of your loans.",
    path: ["loanAmount"], // relative to the step: ["loans", "loanAmount"]
  });

const review = xoe.object({
  terms: xoe.boolean().isTrue("Accept the terms to send the application."),
});

// The whole form is an object of its steps: every step is a key.
export const applicationSchema = xoe.object({
  personal,
  applicant,
  loans,
  review,
});
export type Application = Infer<typeof applicationSchema>;

export type StepKey = keyof typeof applicationSchema.shape;
export const stepKeys = [
  "personal",
  "applicant",
  "loans",
  "review",
] as const satisfies readonly StepKey[];

/** One step, validated on the values of the whole form. */
export const stepSchema = (key: StepKey) => applicationSchema.pick(key);
