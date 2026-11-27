import { useForm } from "../../lib/useForm.ts";
import {
  CheckboxField,
  Row,
  SelectField,
  TextField,
} from "../../ui/fields.tsx";
import { FormSheet } from "../../ui/sheets.tsx";
import { signUpSchema } from "./schema.ts";

const initial = {
  username: "",
  email: "",
  password: "",
  confirmPassword: "",
  birthDate: "",
  plan: "free",
  terms: false,
};

export default function SignUpForm() {
  const form = useForm({
    initial,
    // The schema has an async rule, so validate() would be a type error.
    // The signal cancels the username check when the user keeps typing.
    validate: (values, signal) =>
      signUpSchema.validateAsync(values, { signal }),
    delay: 300,
  });

  return (
    <FormSheet
      title="Create an account"
      form={form}
      submitLabel="Create account"
      call="await schema.validateAsync(values, { signal })"
    >
      <TextField
        form={form}
        name="username"
        label="Username"
        hint='"marko", "ana" and "admin" are taken.'
      />
      <TextField form={form} name="email" label="Email" type="email" />
      <Row>
        <TextField
          form={form}
          name="password"
          label="Password"
          type="password"
        />
        <TextField
          form={form}
          name="confirmPassword"
          label="Repeat the password"
          type="password"
        />
      </Row>
      <Row>
        <TextField
          form={form}
          name="birthDate"
          label="Date of birth"
          type="date"
        />
        <SelectField
          form={form}
          name="plan"
          label="Plan"
          options={signUpSchema.shape.plan.options}
        />
      </Row>
      <CheckboxField form={form} name="terms" label="I accept the terms" />
    </FormSheet>
  );
}
