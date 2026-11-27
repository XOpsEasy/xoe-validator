import { useForm } from "../../lib/useForm.ts";
import { FileField, FormErrors, TextField } from "../../ui/fields.tsx";
import { FormSheet } from "../../ui/sheets.tsx";
import { uploadSchema } from "./schema.ts";

type Values = { title: string; cover?: File; attachments: File[] };
const initial: Values = { title: "", attachments: [] };

export default function FileUploadForm() {
  const form = useForm({
    initial,
    validate: (values) => uploadSchema.validate(values),
  });

  // Issues of one file have the path ["attachments", index].
  const fileErrors = form.values.attachments.flatMap((file, index) =>
    form
      .errors(`attachments.${index}`)
      .map((message) => `${file.name}: ${message}`),
  );

  return (
    <FormSheet title="Publish a report" form={form} submitLabel="Publish">
      <TextField form={form} name="title" label="Title" />
      <FileField
        form={form}
        name="cover"
        label="Cover image"
        accept="image/*"
        hint="An image of at most 1 MB."
      />
      <FileField
        form={form}
        name="attachments"
        label="Attachments"
        accept=".pdf,image/*"
        multiple
        optional
        hint="Up to 3 PDFs or images, 2 MB each."
      />
      <FormErrors errors={fileErrors} />
    </FormSheet>
  );
}
