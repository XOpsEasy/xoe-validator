import { useForm } from "../../lib/useForm.ts";
import { Row, SelectField, TextField } from "../../ui/fields.tsx";
import { FormSheet } from "../../ui/sheets.tsx";
import { profileSchema } from "./schema.ts";

const initial = {
  displayName: "",
  website: "",
  bio: "",
  yearsOfExperience: "",
  language: "",
  handle: "",
};

// isOptional tells whether a field may be left empty (optional or default).
const optional = (field: keyof typeof profileSchema.shape) =>
  profileSchema.shape[field].isOptional;

export default function ProfileForm() {
  const form = useForm({
    initial,
    validate: (values) => profileSchema.validate(values),
  });

  return (
    <FormSheet title="Your profile" form={form} submitLabel="Save profile">
      <TextField form={form} name="displayName" label="Display name" />
      <TextField
        form={form}
        name="handle"
        label="Handle"
        placeholder="@ana_m"
      />
      <TextField
        form={form}
        name="website"
        label="Website"
        placeholder="https://"
        optional={optional("website")}
      />
      <TextField
        form={form}
        name="bio"
        label="Bio"
        rows={3}
        hint="At most 160 characters."
        optional={optional("bio")}
      />
      <Row>
        <TextField
          form={form}
          name="yearsOfExperience"
          label="Years of experience"
          inputMode="numeric"
          optional={optional("yearsOfExperience")}
        />
        <SelectField
          form={form}
          name="language"
          label="Language"
          empty="Default (en)"
          options={profileSchema.shape.language.options}
          optional={optional("language")}
        />
      </Row>
    </FormSheet>
  );
}
