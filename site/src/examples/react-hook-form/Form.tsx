import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { ResultSheets } from "../../ui/sheets.tsx";
import { type Contact, contactSchema } from "./schema.ts";

export default function ReactHookFormExample() {
  const [sent, setSent] = useState<Contact | null>(null);
  const { register, handleSubmit, watch, formState } = useForm({
    // Every xoe validator is a Standard Schema: no adapter of its own.
    resolver: standardSchemaResolver(contactSchema),
    mode: "onTouched",
    defaultValues: { name: "", email: "", message: "", copy: false },
  });
  const { errors } = formState;

  const field = (
    name: keyof typeof errors,
    label: string,
    control: React.ReactNode,
  ) => (
    <div className={errors[name] ? "field field-invalid" : "field"}>
      <label className="field-label" htmlFor={name}>
        {label}
      </label>
      {control}
      {errors[name]?.message && (
        <ul className="field-errors">
          <li>{errors[name].message}</li>
        </ul>
      )}
    </div>
  );

  return (
    <div className="demo">
      <form
        className="sheet form-sheet"
        // handleSubmit calls this with the parsed output of the schema.
        onSubmit={handleSubmit((contact) => setSent(contact))}
        noValidate
      >
        <h2 className="sheet-title">Contact us</h2>
        <div className="fields">
          {field("name", "Name", <input id="name" {...register("name")} />)}
          {field(
            "email",
            "Email",
            <input id="email" type="email" {...register("email")} />,
          )}
          {field(
            "topic",
            "Topic",
            <select id="topic" {...register("topic")}>
              <option value="">Choose a topic</option>
              {contactSchema.shape.topic.options.map((topic) => (
                <option key={topic}>{topic}</option>
              ))}
            </select>,
          )}
          {field(
            "message",
            "Message",
            <textarea id="message" rows={4} {...register("message")} />,
          )}
          <div className="field">
            <label className="choice">
              <input type="checkbox" {...register("copy")} /> Send me a copy
            </label>
          </div>
        </div>
        <div className="form-actions">
          <button type="submit" className="button">
            Send message
          </button>
        </div>
        {sent && (
          <p className="form-done" role="status">
            Sent as {sent.email}.
          </p>
        )}
      </form>
      <div className="demo-side">
        {/* Only for this page: the same schema on the current values. */}
        <ResultSheets
          result={contactSchema.validate(watch())}
          call="contactSchema.validate(watch())"
        />
      </div>
    </div>
  );
}
