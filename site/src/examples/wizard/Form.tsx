import { useEffect, useState } from "react";
import { type FieldApi, useForm } from "../../lib/useForm.ts";
import { CheckboxField, RadioField, TextField } from "../../ui/fields.tsx";
import { FormSheet } from "../../ui/sheets.tsx";
import {
  applicationSchema,
  type StepKey,
  stepKeys,
  stepSchema,
} from "./schema.ts";

const initial = {
  personal: { firstName: "", email: "", birthDate: "" },
  applicant: { type: "person", jmbg: "", companyName: "", pib: "" },
  loans: { hasLoans: false, loanAmount: "" },
  review: { terms: false },
};
type Values = typeof initial;

type StepProps = { form: FieldApi; values: Values };

const steps: Record<
  StepKey,
  { title: string; Fields: (props: StepProps) => React.ReactNode }
> = {
  personal: {
    title: "About you",
    Fields: ({ form }) => (
      <>
        <TextField form={form} name="personal.firstName" label="First name" />
        <TextField
          form={form}
          name="personal.email"
          label="Email"
          type="email"
        />
        <TextField
          form={form}
          name="personal.birthDate"
          label="Date of birth"
          type="date"
        />
      </>
    ),
  },
  applicant: {
    title: "Who is applying",
    Fields: ({ form, values }) => (
      <>
        <RadioField
          form={form}
          name="applicant.type"
          label="Applying as"
          options={[
            { value: "person", label: "A person" },
            { value: "company", label: "A company" },
          ]}
        />
        {values.applicant.type === "person" ? (
          <TextField
            form={form}
            name="applicant.jmbg"
            label="JMBG"
            inputMode="numeric"
            hint="13 digits, e.g. 0101990710008."
          />
        ) : (
          <>
            <TextField
              form={form}
              name="applicant.companyName"
              label="Company name"
            />
            <TextField
              form={form}
              name="applicant.pib"
              label="PIB"
              inputMode="numeric"
              hint="9 digits, e.g. 101134702."
            />
          </>
        )}
      </>
    ),
  },
  loans: {
    title: "Existing loans",
    Fields: ({ form, values }) => (
      <>
        <CheckboxField
          form={form}
          name="loans.hasLoans"
          label="I have other loans"
        />
        {values.loans.hasLoans && (
          <TextField
            form={form}
            name="loans.loanAmount"
            label="Total amount (EUR)"
            inputMode="decimal"
          />
        )}
      </>
    ),
  },
  review: {
    title: "Send",
    Fields: ({ form }) => (
      <CheckboxField
        form={form}
        name="review.terms"
        label="I accept the terms"
      />
    ),
  },
};

export default function WizardForm() {
  const [step, setStep] = useState(0);
  const [sent, setSent] = useState(false);
  const key = stepKeys[step];
  const last = step === stepKeys.length - 1;

  const form = useForm({
    initial,
    // "Next" validates the current step; "Send" validates the whole form.
    validate: (values) =>
      (last ? applicationSchema : stepSchema(key)).validate(values),
    revalidateOn: step,
    onValid: () => (last ? setSent(true) : setStep(step + 1)),
  });

  // A new step starts without messages.
  const { hideErrors } = form;
  useEffect(hideErrors, [step]);

  const { title, Fields } = steps[key];
  const restart = () => {
    form.reset();
    setStep(0);
    setSent(false);
  };

  return (
    <FormSheet
      title={`Loan application, step ${step + 1} of ${stepKeys.length}: ${title}`}
      form={form}
      submitLabel="Send"
      call={
        last
          ? "applicationSchema.validate(values)"
          : `stepSchema("${key}").validate(values)`
      }
      done={sent}
      doneText="Sent. The yellow sheet shows the whole application."
      actions={
        sent ? (
          <button type="button" className="button" onClick={restart}>
            Start a new application
          </button>
        ) : (
          <>
            <button type="submit" className="button">
              {last ? "Send application" : "Next"}
            </button>
            {step > 0 && (
              <button
                type="button"
                className="button-plain"
                onClick={() => setStep(step - 1)}
              >
                Back
              </button>
            )}
          </>
        )
      }
    >
      <Fields form={form} values={form.values} />
    </FormSheet>
  );
}
