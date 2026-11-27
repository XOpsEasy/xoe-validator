import { useId, useState } from "react";
import { ResultSheets } from "../../ui/sheets.tsx";
import { validators } from "./validators.ts";

export default function SingleValueExample() {
  const id = useId();
  const [index, setIndex] = useState(0);
  const [value, setValue] = useState(validators[0].sample);
  const { code, validator } = validators[index];

  const choose = (next: number) => {
    setIndex(next);
    setValue(validators[next].sample);
  };

  return (
    <div className="demo">
      <div className="sheet form-sheet">
        <h2 className="sheet-title">Try a validator</h2>
        <div className="fields">
          <div className="field">
            <label className="field-label" htmlFor={`${id}-validator`}>
              Validator
            </label>
            <select
              id={`${id}-validator`}
              value={index}
              onChange={(event) => choose(Number(event.target.value))}
            >
              {validators.map((entry, at) => (
                <option key={entry.label} value={at}>
                  {entry.label}
                </option>
              ))}
            </select>
            <p className="field-hint">
              <code>{code}</code>
            </p>
          </div>
          <div className="field">
            <label className="field-label" htmlFor={`${id}-value`}>
              Value
            </label>
            <input
              id={`${id}-value`}
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          </div>
        </div>
      </div>
      <div className="demo-side">
        <ResultSheets
          result={validator.validate(value)}
          call="validator.validate(value)"
        />
      </div>
    </div>
  );
}
