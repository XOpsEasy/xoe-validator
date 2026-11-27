// A loan application in four steps (docs/multi-step-forms.md). Every step has
// its own key in the form: the whole form is an object of the steps, a step
// is validated with pick(), and an issue's first path key is its step.
import xoe, {
  type Infer,
  type InferInput,
  rsRules,
  type XOEPath,
} from "@xopseasy/xoe-validator";

const string = xoe.string.extend(rsRules);

// Who applies.
const personal = xoe.object({
  firstName: xoe.string().trim().minLength(2),
  lastName: xoe.string().trim().minLength(2),
  email: xoe.string().trim().toLowerCase().email(),
  birthDate: xoe.coerce.date().minAge(18),
});

// A branch picked by an answer: other fields for a person and a company.
const applicant = xoe.discriminatedUnion("type", {
  person: xoe.object({ jmbg: string().trim().jmbg() }),
  company: xoe.object({
    companyName: xoe.string().trim().minLength(2),
    pib: string().trim().pib(),
    companyNumber: string().trim().companyNumber(),
  }),
});

// A follow-up question: the amount, only when there are loans. The rule of
// the step stays in the step, for the browser and the server.
const loans = xoe.object({
  hasLoans: xoe.coerce.boolean().default(false),
  loanAmount: xoe.coerce.number().positive().maxDecimals(2).optional(),
}).refine((value) => !value.hasLoans || value.loanAmount != null, {
  code: "required",
  message: "Enter the amount of your loans.",
  path: ["loanAmount"],
});

const review = xoe.object({
  terms: xoe.coerce.boolean().default(false).isTrue(),
});

// The whole form, for the last step and the server: its keys are the steps,
// in their order. Rules across steps would go here, as a refine() of it.
export const applicationSchema = xoe.object({ personal, applicant, loans, review });

export type StepKey = keyof typeof applicationSchema.shape;
export const stepKeys = Object.keys(applicationSchema.shape) as StepKey[];

// One step of the form's values: the issues have the same paths as the whole
// form (["applicant", "pib"]), so they go on the same fields.
export const stepSchema = (key: StepKey) => applicationSchema.pick(key);

export type Application = Infer<typeof applicationSchema>;
export type ApplicationInput = InferInput<typeof applicationSchema>;

/** The step of an issue: its first path key (the last step for form-wide issues). */
export const stepOf = (path: XOEPath): number => {
  const index = stepKeys.indexOf(path[0] as StepKey);
  return index === -1 ? stepKeys.length - 1 : index;
};
