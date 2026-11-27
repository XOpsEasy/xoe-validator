// Form fields drawn as the boxes of a printed form: the label sits inside
// the box, and what the user types is set in the typewriter face.
import { type ReactNode, useId } from "react";
import type { FieldApi } from "../lib/useForm.ts";

type FieldProps = {
  form: FieldApi;
  /** A dotted path into the form values, e.g. "items.0.price". */
  name: string;
  label: string;
  hint?: string;
  optional?: boolean;
};

type BoxProps = Omit<FieldProps, "form" | "name"> & {
  id: string;
  errors: readonly string[];
  children: ReactNode;
};

const describedBy = (id: string, hint: unknown, errors: readonly string[]) =>
  [hint ? `${id}-hint` : "", errors.length > 0 ? `${id}-errors` : ""]
    .filter(Boolean)
    .join(" ") || undefined;

const Box = ({ id, label, hint, optional, errors, children }: BoxProps) => (
  <div className={errors.length > 0 ? "field field-invalid" : "field"}>
    <label className="field-label" htmlFor={id}>
      {label}
      {optional && <span className="field-optional"> (optional)</span>}
    </label>
    {children}
    {hint && (
      <p className="field-hint" id={`${id}-hint`}>
        {hint}
      </p>
    )}
    {errors.length > 0 && (
      <ul className="field-errors" id={`${id}-errors`}>
        {errors.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
    )}
  </div>
);

const text = (value: unknown) =>
  typeof value === "string" || typeof value === "number" ? String(value) : "";

type TextFieldProps = FieldProps & {
  type?: "text" | "email" | "password" | "date" | "datetime-local" | "url";
  placeholder?: string;
  inputMode?: "numeric" | "decimal" | "email" | "url";
  autoComplete?: string;
  /** Renders a textarea with this many rows. */
  rows?: number;
};

export const TextField = ({ form, name, rows, ...props }: TextFieldProps) => {
  const id = useId();
  const { label, hint, optional, ...input } = props;
  const errors = form.errors(name);
  const shared = {
    id,
    value: text(form.get(name)),
    onBlur: () => form.touch(name),
    "aria-invalid": errors.length > 0 || undefined,
    "aria-describedby": describedBy(id, hint, errors),
    placeholder: input.placeholder,
  };
  return (
    <Box id={id} label={label} hint={hint} optional={optional} errors={errors}>
      {rows ? (
        <textarea
          {...shared}
          rows={rows}
          onChange={(event) => form.set(name, event.target.value)}
        />
      ) : (
        <input
          {...shared}
          type={input.type ?? "text"}
          inputMode={input.inputMode}
          autoComplete={input.autoComplete ?? "off"}
          onChange={(event) => form.set(name, event.target.value)}
        />
      )}
    </Box>
  );
};

type Option = string | { value: string; label: string };

const optionOf = (option: Option) =>
  typeof option === "string" ? { value: option, label: option } : option;

type ChoiceProps = FieldProps & {
  options: readonly Option[];
  /** The label of the empty choice; without it there is none. */
  empty?: string;
};

export const SelectField = ({
  form,
  name,
  options,
  empty,
  ...props
}: ChoiceProps) => {
  const id = useId();
  const errors = form.errors(name);
  return (
    <Box id={id} errors={errors} {...props}>
      <select
        id={id}
        value={text(form.get(name))}
        onBlur={() => form.touch(name)}
        onChange={(event) => form.set(name, event.target.value)}
        aria-invalid={errors.length > 0 || undefined}
        aria-describedby={describedBy(id, props.hint, errors)}
      >
        {empty !== undefined && <option value="">{empty}</option>}
        {options.map(optionOf).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Box>
  );
};

export const RadioField = ({ form, name, options, ...props }: ChoiceProps) => {
  const id = useId();
  const errors = form.errors(name);
  return (
    <div
      className={errors.length > 0 ? "field field-invalid" : "field"}
      role="radiogroup"
      aria-labelledby={`${id}-label`}
    >
      <span className="field-label" id={`${id}-label`}>
        {props.label}
      </span>
      <div className="choices">
        {options.map(optionOf).map((option) => (
          <label key={option.value} className="choice">
            <input
              type="radio"
              name={id}
              checked={form.get(name) === option.value}
              onChange={() => form.set(name, option.value)}
              onBlur={() => form.touch(name)}
            />
            {option.label}
          </label>
        ))}
      </div>
      {errors.length > 0 && (
        <ul className="field-errors">
          {errors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}
    </div>
  );
};

export const CheckboxField = ({ form, name, label, hint }: FieldProps) => {
  const id = useId();
  const errors = form.errors(name);
  return (
    <div className={errors.length > 0 ? "field field-invalid" : "field"}>
      <label className="choice" htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          checked={form.get(name) === true}
          onChange={(event) => {
            form.set(name, event.target.checked);
            form.touch(name);
          }}
          aria-invalid={errors.length > 0 || undefined}
          aria-describedby={describedBy(id, hint, errors)}
        />
        {label}
      </label>
      {hint && (
        <p className="field-hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {errors.length > 0 && (
        <ul className="field-errors" id={`${id}-errors`}>
          {errors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}
    </div>
  );
};

type FileFieldProps = FieldProps & { accept?: string; multiple?: boolean };

/** Stores a File, or a File[] with `multiple`. */
export const FileField = ({
  form,
  name,
  accept,
  multiple,
  ...props
}: FileFieldProps) => {
  const id = useId();
  const errors = form.errors(name);
  return (
    <Box id={id} errors={errors} {...props}>
      <input
        id={id}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          form.set(name, multiple ? files : files[0]);
          form.touch(name);
        }}
        aria-invalid={errors.length > 0 || undefined}
        aria-describedby={describedBy(id, props.hint, errors)}
      />
    </Box>
  );
};

/** Fields side by side; they stack on narrow screens. */
export const Row = ({ children }: { children: ReactNode }) => (
  <div className="field-row">{children}</div>
);

/** Messages that belong to no single field, e.g. issues with an empty path. */
export const FormErrors = ({ errors }: { errors: readonly string[] }) =>
  errors.length > 0 ? (
    <ul className="field-errors form-errors" role="alert">
      {errors.map((message) => (
        <li key={message}>{message}</li>
      ))}
    </ul>
  ) : null;
