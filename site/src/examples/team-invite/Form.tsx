import { useForm } from "../../lib/useForm.ts";
import { FormErrors, SelectField, TextField } from "../../ui/fields.tsx";
import { FormSheet } from "../../ui/sheets.tsx";
import { inviteSchema, roleSchema } from "./schema.ts";

const initial = {
  emails: "ana@example.com, marko@example, Ana@Example.com",
  role: "",
  message: "",
};

export default function TeamInviteForm() {
  const form = useForm({
    initial,
    validate: (values) => inviteSchema.validate(values),
  });

  // Issues of single addresses have the path ["emails", index].
  const addressErrors =
    form.result?.type === "error"
      ? form.result.value
          .filter(
            (issue) => issue.path[0] === "emails" && issue.path.length === 2,
          )
          .map(
            (issue) => `Address ${Number(issue.path[1]) + 1}: ${issue.message}`,
          )
      : [];

  return (
    <FormSheet title="Invite teammates" form={form} submitLabel="Send invites">
      <TextField
        form={form}
        name="emails"
        label="Email addresses"
        rows={3}
        hint="Up to 5, separated by commas, spaces or new lines."
      />
      <FormErrors errors={addressErrors} />
      <SelectField
        form={form}
        name="role"
        label="Role"
        empty="Default (viewer)"
        // The values of the enum, so the select can't drift from the schema.
        options={roleSchema.options}
      />
      <TextField form={form} name="message" label="Message" rows={2} optional />
    </FormSheet>
  );
}
