// A multi-step form with react-hook-form (docs/multi-step-forms.md):
// - the steps are a list: a key of the form, a title and its fields;
// - each step is validated with its own schema before "Next";
// - the whole form is validated at the end and sent once;
// - server issues go to the step of their field.
import { type ReactNode, useRef, useState } from "react";
import { get, type Resolver, useForm, type UseFormReturn } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { localized, localizeIssues, type XOEIssue } from "@x-ops-easy/xoe-validator";
import {
  type Application,
  applicationSchema,
  type StepKey,
  stepKeys,
  stepOf,
  stepSchema,
} from "../../shared/application.ts";
import { post } from "./api.ts";
import { messages, type Lang } from "./messages.ts";

// The values while filling in the form, as the inputs hold them: every
// step, also the fields of the branch that isn't picked.
type Values = {
  personal: { firstName: string; lastName: string; email: string; birthDate: string };
  applicant: {
    type: "person" | "company";
    jmbg?: string;
    companyName?: string;
    pib?: string;
    companyNumber?: string;
  };
  loans: { hasLoans: boolean; loanAmount?: string };
  review: { terms: boolean };
};
type Form = UseFormReturn<Values>;
type Field = Parameters<Form["register"]>[0];

const ErrorOf = ({ form, name }: { form: Form; name: Field }) => {
  const error = get(form.formState.errors, name) as { message?: string } | undefined;
  return error?.message ? <small className="error">{error.message}</small> : null;
};

const Input = ({ form, name, label, ...props }: {
  form: Form;
  name: Field;
  label: string;
  type?: string;
  inputMode?: "numeric" | "decimal";
  shouldUnregister?: boolean;
}) => (
  <>
    <label>
      {label}
      <input
        type={props.type}
        inputMode={props.inputMode}
        {...form.register(name, { shouldUnregister: props.shouldUnregister })}
      />
    </label>
    <ErrorOf form={form} name={name} />
  </>
);

// The steps, in the order of applicationSchema. A new step is a key in the
// schema and an entry here.
const stepViews: Record<StepKey, { title: string; Fields: (props: { form: Form }) => ReactNode }> = {
  personal: {
    title: "Personal details",
    Fields: ({ form }) => (
      <>
        <Input form={form} name="personal.firstName" label="First name" />
        <Input form={form} name="personal.lastName" label="Last name" />
        <Input form={form} name="personal.email" label="Email" />
        <Input form={form} name="personal.birthDate" label="Birth date" type="date" />
      </>
    ),
  },
  applicant: {
    title: "Applicant",
    Fields: ({ form }) => (
      <>
        <label>
          Applying as
          <select {...form.register("applicant.type")}>
            <option value="person">a person</option>
            <option value="company">a company</option>
          </select>
        </label>
        {/* A branch's fields leave the values when it's hidden. */}
        {form.watch("applicant.type") === "person"
          ? <Input form={form} name="applicant.jmbg" label="JMBG" inputMode="numeric" shouldUnregister />
          : (
            <>
              <Input form={form} name="applicant.companyName" label="Company name" shouldUnregister />
              <Input form={form} name="applicant.pib" label="PIB" inputMode="numeric" shouldUnregister />
              <Input
                form={form}
                name="applicant.companyNumber"
                label="Company number"
                inputMode="numeric"
                shouldUnregister
              />
            </>
          )}
      </>
    ),
  },
  loans: {
    title: "Loans",
    Fields: ({ form }) => (
      <>
        <label className="row">
          <input type="checkbox" {...form.register("loans.hasLoans")} /> I have other loans
        </label>
        {form.watch("loans.hasLoans") && (
          <Input
            form={form}
            name="loans.loanAmount"
            label="Amount of the loans"
            inputMode="decimal"
            shouldUnregister
          />
        )}
      </>
    ),
  },
  review: {
    title: "Review",
    Fields: ({ form }) => (
      <>
        <pre>{JSON.stringify(form.watch(), null, 2)}</pre>
        <label className="row">
          <input type="checkbox" {...form.register("review.terms")} /> I agree to the terms
        </label>
        <ErrorOf form={form} name="review.terms" />
      </>
    ),
  },
};

// A step's schema validates a part of Values, the resolver gets all of them.
const stepResolver = (key: StepKey, lang: () => Lang) =>
  standardSchemaResolver(
    localized(stepSchema(key), () => messages[lang()]),
  ) as unknown as Resolver<Values>;

export function StepForm({ lang }: { lang: Lang }) {
  const [step, setStep] = useState(0);
  const [sent, setSent] = useState<Application | null>(null);

  // A resolver per step, created once; the form's resolver runs the one of
  // the current step, read from a ref (it's called outside of renders).
  const current = useRef({ step, lang });
  current.current = { step, lang };
  const [resolvers] = useState(() => stepKeys.map((key) => stepResolver(key, () => current.current.lang)));

  const form = useForm<Values>({
    resolver: (...args) => resolvers[current.current.step](...args),
    defaultValues: {
      applicant: { type: "person" },
      loans: { hasLoans: false },
      review: { terms: false },
    },
  });

  // Issues of the whole form (local or from the server): show them on their
  // fields and go to the first step that has one.
  const showIssues = (issues: readonly XOEIssue[]) => {
    for (const issue of localizeIssues(issues, messages[lang])) {
      form.setError(issue.path.join(".") as Field, { type: issue.code, message: issue.message });
    }
    setStep(Math.min(...issues.map((issue) => stepOf(issue.path))));
  };

  const next = async () => {
    if (await form.trigger()) setStep(step + 1);
  };

  const send = async () => {
    if (!(await form.trigger())) return;
    // The whole form, with the rules across steps, before sending it.
    const whole = applicationSchema.validate(form.getValues());
    if (whole.type === "error") return showIssues(whole.value);
    const result = await post<{ application: Application }>("/api/applications", whole.value);
    if (result.ok) setSent(result.data.application);
    else showIssues(result.issues);
  };

  const last = step === stepKeys.length - 1;
  return (
    <form onSubmit={(event) => event.preventDefault()} noValidate>
      <h2>
        Loan application, step {step + 1} of {stepKeys.length}: {stepViews[stepKeys[step]].title}
      </h2>

      {/* Every step stays mounted (only hidden), so its values are kept. */}
      {stepKeys.map((key, index) => {
        const { Fields } = stepViews[key];
        return (
          <fieldset key={key} hidden={index !== step}>
            <Fields form={form} />
          </fieldset>
        );
      })}

      <div className="row">
        {step > 0 && <button type="button" onClick={() => setStep(step - 1)}>Back</button>}{" "}
        {last
          ? <button type="button" onClick={send}>Send</button>
          : <button type="button" onClick={next}>Next</button>}
      </div>
      {sent && <pre>{JSON.stringify(sent, null, 2)}</pre>}
      <p className="hint">
        Valid: JMBG 0101990710008; PIB 101134702 and company number 17162543.
      </p>
    </form>
  );
}
