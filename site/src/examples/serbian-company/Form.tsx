import { useState } from "react";
import { localizeIssues, mapError } from "@x-ops-easy/xoe-validator";
import { type FieldApi, useForm } from "../../lib/useForm.ts";
import { RadioField, Row, TextField } from "../../ui/fields.tsx";
import { FormSheet } from "../../ui/sheets.tsx";
import { type Lang, messages } from "./messages.ts";
import { companySchema } from "./schema.ts";

const initial = {
  name: "",
  pib: "",
  companyNumber: "",
  director: "",
  employees: "",
};

const labels = {
  en: {
    name: "Company name",
    pib: "PIB (tax ID)",
    companyNumber: "Company number",
    director: "Director's JMBG",
    employees: "Employees",
  },
  sr: {
    name: "Naziv firme",
    pib: "PIB",
    companyNumber: "Matični broj",
    director: "JMBG direktora",
    employees: "Broj zaposlenih",
  },
};

export default function SerbianCompanyForm() {
  const [lang, setLang] = useState<Lang>("sr");
  const form = useForm({
    initial,
    // The schema knows nothing about languages. The issues are data, and
    // localizeIssues() gives them the messages of a catalog.
    validate: (values) =>
      mapError(companySchema.validate(values), (issues) =>
        localizeIssues(issues, messages[lang]),
      ),
    revalidateOn: lang,
  });

  // The language switch isn't part of the form values.
  const language: FieldApi = {
    get: () => lang,
    set: (_path, value) => setLang(value === "en" ? "en" : "sr"),
    touch: () => {},
    errors: () => [],
  };
  const label = labels[lang];

  return (
    <FormSheet
      title={lang === "sr" ? "Registracija firme" : "Register a company"}
      form={form}
      submitLabel={lang === "sr" ? "Registruj firmu" : "Register company"}
      call="localizeIssues(issues, messages[lang])"
    >
      <RadioField
        form={language}
        name="lang"
        label="Messages in"
        options={[
          { value: "sr", label: "Serbian" },
          { value: "en", label: "English" },
        ]}
      />
      <TextField form={form} name="name" label={label.name} />
      <Row>
        <TextField
          form={form}
          name="pib"
          label={label.pib}
          inputMode="numeric"
          hint="101134702"
        />
        <TextField
          form={form}
          name="companyNumber"
          label={label.companyNumber}
          inputMode="numeric"
          hint="17162543"
        />
      </Row>
      <TextField
        form={form}
        name="director"
        label={label.director}
        inputMode="numeric"
        hint="0101990710008"
        optional
      />
      <TextField
        form={form}
        name="employees"
        label={label.employees}
        inputMode="numeric"
      />
    </FormSheet>
  );
}
