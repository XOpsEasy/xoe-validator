# Multi-step forms

A form in steps (a wizard) needs no special API. Give every step its own key in
the form: the whole form is an object of the steps, a step is validated with
`pick`, and the first key of an issue's path is its step. The full example, with
react-hook-form, is in [examples/fullstack](../examples/fullstack)
(`shared/application.ts`, `frontend/src/StepForm.tsx`).

## The whole form and its steps

```ts
import xoe, { type Infer, type XOEPath } from "@x-ops-easy/xoe-validator";

const personal = xoe.object({
  firstName: xoe.string().trim().minLength(2),
  email: xoe.string().trim().email(),
  birthDate: xoe.coerce.date().minAge(18),
});

const loans = xoe.object({
  hasLoans: xoe.coerce.boolean().default(false),
  loanAmount: xoe.coerce.number().positive().optional(),
});

const review = xoe.object({
  terms: xoe.coerce.boolean().default(false).isTrue(),
});

// The keys are the steps, in their order.
export const applicationSchema = xoe.object({ personal, loans, review });
export type Application = Infer<typeof applicationSchema>;

export type StepKey = keyof typeof applicationSchema.shape;
export const stepKeys = Object.keys(applicationSchema.shape) as StepKey[];

// One step, validated on the values of the whole form.
export const stepSchema = (key: StepKey) => applicationSchema.pick(key);
```

The values look like `{ personal: {...}, loans: {...}, review: {...} }`, and the
issues of a step have the same paths in the step and in the whole form
(`["loans", "loanAmount"]`), so they go on the same fields. `pick` removes the
other steps from the output and doesn't report them.

A new step is a key in `applicationSchema`, wherever it goes in the order.
Fields of different steps can have the same name (`email` of a person and of a
company), since every step has its own object.

## Rules of a step and across steps

A rule of a step is a `refine` of the step's object. It's part of the whole form
too, so it runs in the browser on "Next" and on the server:

```ts
const loans = xoe
  .object({
    hasLoans: xoe.coerce.boolean().default(false),
    loanAmount: xoe.coerce.number().positive().optional(),
  })
  .refine((value) => !value.hasLoans || value.loanAmount != null, {
    code: "required",
    message: "Enter the amount of your loans.",
    path: ["loanAmount"], // relative to the step: ["loans", "loanAmount"]
  });
```

A rule that reads several steps is a `refine` of the whole form, with a path
into the step where it's shown. It runs at the end, and only when all the steps
are valid (a `refine` of an object runs only when its fields are). To show it
earlier, check it in the step where its last field is entered, with `pick` of
the steps it reads:

```ts
const startsAfterBirth = (value: {
  personal: { birthDate: Date };
  job: { since: Date };
}) => value.job.since > value.personal.birthDate;
const rule = { message: "Check the date.", path: ["job", "since"] };

export const applicationSchema = xoe
  .object({ personal, job, review })
  .refine(startsAfterBirth, rule);
const jobStep = applicationSchema
  .pick("personal", "job")
  .refine(startsAfterBirth, rule);
```

## Questions that depend on an answer

**A branch** (a person or a company, with different fields) is a
`discriminatedUnion`. A step can be one: it validates only the fields of the
selected branch and removes the fields of the other one, so values entered
before switching aren't sent:

```ts
const applicant = xoe.discriminatedUnion("type", {
  person: xoe.object({ jmbg: string().trim().jmbg() }),
  company: xoe.object({
    companyName: xoe.string().trim().minLength(2),
    pib: string().trim().pib(),
  }),
});

export const applicationSchema = xoe.object({
  personal,
  applicant,
  loans,
  review,
});
```

**A follow-up question** (the amount, only when there are loans) is an
`optional()` field with a `refine`, as `loans` above. In the form, remove a
hidden field's value, so an old answer doesn't stay in the values
(react-hook-form: `register("loans.loanAmount", { shouldUnregister: true })`).

**A whole step that depends on an answer** has no API either: make it
`optional()` and check it with a `refine` of the whole form, and skip it in the
form's list of steps. With many such steps, the order of the steps is the form's
logic (a state machine), not the schema's.

## In the browser

Validate the current step before going on, and the whole form before sending it.
With react-hook-form, the resolver runs the schema of the current step; the step
is read from a ref, since the resolver is called outside of renders:

```tsx
const current = useRef(step);
current.current = step;
const [resolvers] = useState(() =>
  stepKeys.map((key) =>
    standardSchemaResolver(localized(stepSchema(key), messages)),
  ),
);
const form = useForm<Values>({
  resolver: (...args) => resolvers[current.current](...args),
});

const next = async () => {
  if (await form.trigger()) setStep(step + 1);
};
```

The steps are a list, so the form renders them in a loop, whatever their number
is:

```tsx
const stepViews: Record<StepKey, { title: string; Fields: FieldsComponent }> = {
  personal: { title: "Personal details", Fields: PersonalFields },
  // ...
};

{
  stepKeys.map((key, index) => {
    const { Fields } = stepViews[key];
    return (
      <fieldset key={key} hidden={index !== step}>
        <Fields form={form} />
      </fieldset>
    );
  });
}
```

Keep the steps mounted and hide the inactive ones (`<fieldset hidden>`):
react-hook-form keeps the values of unmounted fields, but not of fields
registered with `shouldUnregister`, which would lose a branch's values on
"Next".

The form's values type lists the fields of every step, of both branches, as the
inputs hold them (strings, booleans). `InferInput<typeof applicationSchema>` is
the type the schema accepts, not what the inputs hold before validation.

## On the server

Send the whole form once, at the end, and validate it with the whole schema: the
browser checks are for the user, the server check is the one that counts.

```ts
app.post("/api/applications", async (c) => {
  const result = applicationSchema.validate(await c.req.json());
  if (result.type === "error") return c.json({ issues: result.value }, 400);
  return c.json({ application: result.value }, 201);
});
```

The server's issues go back to the step of their field, the first key of the
path:

```ts
export const stepOf = (path: XOEPath): number => {
  const index = stepKeys.indexOf(path[0] as StepKey);
  return index === -1 ? stepKeys.length - 1 : index;
};

// On a 400 response: show the issues on their fields, go to the first step.
for (const issue of localizeIssues(issues, messages)) {
  form.setError(issue.path.join("."), {
    type: issue.code,
    message: issue.message,
  });
}
setStep(Math.min(...issues.map((issue) => stepOf(issue.path))));
```

Issues without a path (a `refine` of the whole form without one) go to the last
step.

## Many steps

The number of steps isn't a limit: the steps are a list, and a step is a key.
TypeScript checks a form of 20 steps with 60 fields in a fraction of a second.
Steps not known at build time (from a CMS or the backend) can come as JSON
Schema, one per step, validated with [`xoe.jsonSchema`](json-schema.md) on both
sides; their types are then known only at runtime.
