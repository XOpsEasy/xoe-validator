// xoe used directly: validate on submit, translate the issues and show them
// per field. The server validates the same schema.
import { useState, type FormEvent } from "react";
import {
  localizeIssues,
  toFieldErrors,
  type XOEFieldErrors,
  type XOEIssue,
} from "@x-ops-easy/xoe-validator";
import { companySchema, type Company } from "../../shared/schemas.ts";
import { post } from "./api.ts";
import { messages, type Lang } from "./messages.ts";

export function CompanyForm({ lang }: { lang: Lang }) {
  const [issues, setIssues] = useState<readonly XOEIssue[]>([]);
  const [saved, setSaved] = useState<Company | null>(null);
  // Issues are data: switching the language needs no new validation.
  const errors: XOEFieldErrors = toFieldErrors(localizeIssues(issues, messages[lang]));
  const show = (field: string) =>
    errors[field]?.map((message) => <small key={message} className="error">{message}</small>);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const local = companySchema.validate(data);
    if (local.type === "error") return setIssues(local.value);

    const result = await post<{ company: Company }>("/api/companies", local.value);
    if (!result.ok) return setIssues(result.issues);
    setIssues([]);
    setSaved(result.data.company);
  };

  return (
    <form onSubmit={onSubmit} noValidate>
      <h2>Company (xoe directly, Serbian rules)</h2>
      <label>Name <input name="name" /></label>
      {show("name")}
      <label>PIB <input name="pib" inputMode="numeric" /></label>
      {show("pib")}
      <label>Company number (matični broj) <input name="companyNumber" inputMode="numeric" /></label>
      {show("companyNumber")}
      <label>Director's JMBG (optional) <input name="director" inputMode="numeric" /></label>
      {show("director")}
      <button>Save</button>
      {saved && <pre>{JSON.stringify(saved, null, 2)}</pre>}
      <p className="hint">Valid: PIB 101134702, company number 17162543.</p>
    </form>
  );
}
