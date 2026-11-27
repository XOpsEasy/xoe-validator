import { useForm } from "../../lib/useForm.ts";
import { FormErrors, TextField } from "../../ui/fields.tsx";
import { FormSheet } from "../../ui/sheets.tsx";
import { importSchema } from "./schema.ts";

const initial = {
  text: '{\n  "theme": "blue",\n  "fontSize": 14.5,\n  "plugin": ["spellcheck"]\n}',
};

export default function JsonImportForm() {
  const form = useForm({
    initial,
    // A validator validates any value: here a string, not an object.
    validate: (values) => importSchema.validate(values.text),
  });

  const errors =
    form.result?.type === "error"
      ? form.result.value.map((issue) =>
          issue.path.length > 0
            ? `${issue.path.join(".")}: ${issue.message}`
            : issue.message,
        )
      : [];

  return (
    <FormSheet
      title="Import settings"
      form={form}
      submitLabel="Import"
      call="importSchema.validate(text)"
    >
      <TextField
        form={form}
        name="text"
        label="settings.json"
        rows={8}
        hint='Fix it: "theme" is light or dark, "fontSize" a whole number, and the key is "plugins".'
      />
      <FormErrors errors={errors} />
    </FormSheet>
  );
}
