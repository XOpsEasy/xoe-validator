// A form with xoe and nothing else: React state, validate() and
// toFieldErrors(). The other examples use useForm.ts (the second tab), which
// is this pattern with a few more details.
import { type FormEvent, useState } from "react";
import xoe, { toFieldErrors } from "@x-ops-easy/xoe-validator";
import { ResultSheets } from "../../ui/sheets.tsx";

const schema = xoe.object({
  email: xoe.string().trim().toLowerCase().email(),
  age: xoe.coerce.number().integer().minimum(18),
});

export default function WiringExample() {
  const [values, setValues] = useState({ email: "", age: "" });
  const [submitted, setSubmitted] = useState(false);

  // Validating is cheap: do it on every render.
  const result = schema.validate(values);
  // { email: ["..."], age: ["..."] }
  const errors =
    submitted && result.type === "error" ? toFieldErrors(result.value) : {};

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (result.type === "success") console.log("send", result.value);
  };

  return (
    <div className="demo">
      <form className="sheet form-sheet" onSubmit={submit} noValidate>
        <h2 className="sheet-title">Join the waiting list</h2>
        <div className="fields">
          <div className={errors.email ? "field field-invalid" : "field"}>
            <label className="field-label" htmlFor="wiring-email">
              Email
            </label>
            <input
              id="wiring-email"
              value={values.email}
              onChange={(event) =>
                setValues({ ...values, email: event.target.value })
              }
            />
            <ul className="field-errors">
              {errors.email?.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </div>
          <div className={errors.age ? "field field-invalid" : "field"}>
            <label className="field-label" htmlFor="wiring-age">
              Age
            </label>
            <input
              id="wiring-age"
              inputMode="numeric"
              value={values.age}
              onChange={(event) =>
                setValues({ ...values, age: event.target.value })
              }
            />
            <ul className="field-errors">
              {errors.age?.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="form-actions">
          <button type="submit" className="button">
            Join
          </button>
        </div>
      </form>
      <div className="demo-side">
        <ResultSheets result={result} />
      </div>
    </div>
  );
}
