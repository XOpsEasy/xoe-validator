import { useForm } from "../../lib/useForm.ts";
import { CheckboxField, TextField } from "../../ui/fields.tsx";
import { FormSheet } from "../../ui/sheets.tsx";
import { type Login, loginSchema } from "./schema.ts";

const initial = { email: "", password: "", remember: false };

export default function LoginForm() {
  const form = useForm({
    initial,
    // The whole example: validate() returns the output or the issues.
    validate: (values) => loginSchema.validate(values),
    onValid: (login: Login) => console.log("log in", login.email),
  });

  return (
    <FormSheet title="Log in" form={form} submitLabel="Log in">
      <TextField form={form} name="email" label="Email" type="email" />
      <TextField form={form} name="password" label="Password" type="password" />
      <CheckboxField form={form} name="remember" label="Keep me logged in" />
    </FormSheet>
  );
}
