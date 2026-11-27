import { useState } from "react";
import { xoeSuccess } from "@xopseasy/xoe-validator";
import { type FieldApi, type FormResult, useForm } from "../../lib/useForm.ts";
import { CheckboxField, TextField } from "../../ui/fields.tsx";
import { FormSheet } from "../../ui/sheets.tsx";
import { workspaceSchema } from "./schema.ts";
import { createWorkspace, type Response } from "./server.ts";

const initial = { email: "", workspace: "acme", seats: "5" };

export default function ServerIssuesForm() {
  const [skipBrowser, setSkipBrowser] = useState(false);
  const [response, setResponse] = useState<Response | null>(null);

  const form = useForm({
    initial,
    validate: (values): FormResult =>
      skipBrowser ? xoeSuccess(values) : workspaceSchema.validate(values),
    revalidateOn: skipBrowser,
    // The issues of a 400 answer go on the fields by their path, exactly
    // like the issues found in the browser.
    onValid: async (values) => {
      const answer = await createWorkspace(values);
      setResponse(answer);
      return answer.status === 400 ? answer.body.issues : undefined;
    },
  });

  const skip: FieldApi = {
    get: () => skipBrowser,
    set: (_path, value) => setSkipBrowser(value === true),
    touch: () => {},
    errors: () => [],
  };

  return (
    <FormSheet
      title="Create a workspace"
      form={form}
      submitLabel="Create workspace"
      doneText="Created. The server accepted the values."
      aside={
        response && (
          <div className="sheet response-sheet">
            <h3>The server answered {response.status}</h3>
            <pre>{JSON.stringify(response.body, null, 2)}</pre>
          </div>
        )
      }
    >
      <TextField form={form} name="email" label="Your email" type="email" />
      <TextField
        form={form}
        name="workspace"
        label="Workspace name"
        hint='"acme" and "foleon" exist already. Only the server knows that.'
      />
      <TextField form={form} name="seats" label="Seats" inputMode="numeric" />
      <CheckboxField
        form={skip}
        name="skip"
        label="Skip validation in the browser"
        hint="Sends the values as they are, so the server finds every issue."
      />
    </FormSheet>
  );
}
