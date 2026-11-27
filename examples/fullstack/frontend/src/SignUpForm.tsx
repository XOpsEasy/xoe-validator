// react-hook-form with xoe through Standard Schema: the resolver runs the
// shared schema (with its async username check) in the browser, with messages
// in the chosen language (localized); the server runs the same schema again
// and its issues are shown on the fields too.
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import {
  localized,
  localizeIssues,
  toFieldErrors,
} from "@x-ops-easy/xoe-validator";
import { signUpSchema, type SignUp } from "../../shared/schemas.ts";
import { isUsernameFree, post } from "./api.ts";
import { messages, type Lang } from "./messages.ts";
import { useState } from "react";

const schema = signUpSchema(isUsernameFree);

export function SignUpForm({ lang }: { lang: Lang }) {
  const [created, setCreated] = useState<unknown>(null);
  const { register, handleSubmit, setError, formState } = useForm({
    // localized: the resolver only shows issue.message, so translate them.
    resolver: standardSchemaResolver(localized(schema, () => messages[lang])),
  });

  const onSubmit = async (values: SignUp) => {
    const result = await post<{ user: unknown }>("/api/users", values);
    if (result.ok) return setCreated(result.data.user);
    // Server issues: translated here, then shown on their fields.
    const fields = toFieldErrors(localizeIssues(result.issues, messages[lang]));
    for (const [field, [message]] of Object.entries(fields)) {
      setError(field as keyof SignUp, { type: "server", message });
    }
  };

  const error = (field: keyof SignUp) =>
    formState.errors[field]?.message && (
      <small className="error">{String(formState.errors[field]?.message)}</small>
    );

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <h2>Sign up (react-hook-form + Standard Schema)</h2>
      <label>Username <input {...register("username")} /></label>
      {error("username")}
      <label>Email <input {...register("email")} /></label>
      {error("email")}
      <label>Password <input type="password" {...register("password")} /></label>
      {error("password")}
      <label>
        Confirm password <input type="password" {...register("confirmPassword")} />
      </label>
      {error("confirmPassword")}
      <label>Birth date <input type="date" {...register("birthDate")} /></label>
      {error("birthDate")}
      <label>
        Role
        <select {...register("role")}>
          <option value="user">user</option>
          <option value="admin">admin</option>
        </select>
      </label>
      <label className="row">
        <input type="checkbox" {...register("newsletter")} /> Newsletter
      </label>
      <button disabled={formState.isSubmitting}>
        {formState.isSubmitting ? "Checking..." : "Sign up"}
      </button>
      {created !== null && <pre>{JSON.stringify(created, null, 2)}</pre>}
      <p className="hint">Try the username "marko" (taken) or a birth date under 18.</p>
    </form>
  );
}
