import { useState } from "react";
import { toJsonSchema } from "@xopseasy/xoe-validator";
import { createUserSchema } from "./schema.ts";

const targets = [
  { value: "draft-2020-12", label: "JSON Schema 2020-12 (OpenAPI 3.1)" },
  { value: "openapi-3.0", label: "OpenAPI 3.0" },
] as const;
type Target = (typeof targets)[number]["value"];

export default function OpenApiExample() {
  const [target, setTarget] = useState<Target>("draft-2020-12");
  // The schema you validate with is the one you document.
  const schema = toJsonSchema(createUserSchema, { target });

  return (
    <div className="demo">
      <div className="sheet form-sheet">
        <h2 className="sheet-title">Describe the schema for</h2>
        <div className="fields">
          <div className="field" role="radiogroup" aria-label="Target">
            <div className="choices choices-stacked">
              {targets.map((item) => (
                <label key={item.value} className="choice">
                  <input
                    type="radio"
                    name="target"
                    checked={target === item.value}
                    onChange={() => setTarget(item.value)}
                  />
                  {item.label}
                </label>
              ))}
            </div>
            <p className="field-hint">
              Compare how "website" (nullable) and the examples of "age" are
              written.
            </p>
          </div>
        </div>
      </div>
      <div className="demo-side">
        <section className="result result-success">
          <div className="sheet result-sheet">
            <header className="result-head">
              <code>
                toJsonSchema(createUserSchema, {`{ target: "${target}" }`})
              </code>
            </header>
            <pre className="result-value">
              {JSON.stringify(schema, null, 2)}
            </pre>
          </div>
        </section>
      </div>
    </div>
  );
}
