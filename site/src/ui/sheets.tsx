// The three sheets of a carbon-copy form: the white one is filled in, the
// yellow copy shows the parsed output, the pink copy the issues.
import type { FormEvent, ReactNode } from "react";
import type { XOEIssue } from "@xopseasy/xoe-validator";
import { formatValue } from "../lib/format.ts";
import type { FormResult } from "../lib/useForm.ts";

type ResultProps = {
  result: FormResult | null;
  pending?: boolean;
  /** The call that produced the result, shown above it. */
  call?: string;
};

const Issue = ({ issue }: { issue: XOEIssue }) => (
  <li className="issue">
    <div className="issue-where">
      <span className="issue-path">
        {issue.path.length > 0 ? issue.path.join(".") : "(the value itself)"}
      </span>
      <code>{issue.code}</code>
    </div>
    <p>{issue.message}</p>
    {issue.params && (
      <code className="issue-params">
        params {JSON.stringify(issue.params)}
      </code>
    )}
  </li>
);

export const ResultSheets = ({
  result,
  pending = false,
  call = "schema.validate(values)",
}: ResultProps) => {
  const kind = result?.type ?? "idle";
  return (
    <section className={`result result-${kind}`} aria-live="polite">
      <div className="sheet result-sheet">
        <header className="result-head">
          <code>{call}</code>
          <span className="result-state">
            {pending ? "checking" : kind === "idle" ? "" : `type: "${kind}"`}
          </span>
        </header>
        {result === null && (
          <p className="result-empty">Nothing validated yet.</p>
        )}
        {result?.type === "success" && (
          <>
            <h3>Output</h3>
            <pre className="result-value">{formatValue(result.value)}</pre>
          </>
        )}
        {result?.type === "error" && (
          <>
            <h3>
              {result.value.length === 1
                ? "1 issue"
                : `${result.value.length} issues`}
            </h3>
            <ol className="issues">
              {result.value.map((issue, index) => (
                <Issue key={index} issue={issue} />
              ))}
            </ol>
          </>
        )}
      </div>
    </section>
  );
};

export const Sheet = ({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) => (
  <div className="sheet form-sheet">
    <h2 className="sheet-title">{title}</h2>
    {children}
  </div>
);

type FormSheetProps = {
  title: string;
  form: {
    result: FormResult | null;
    pending: boolean;
    done: boolean;
    submit: (event: FormEvent) => void;
    reset: () => void;
  };
  submitLabel: string;
  /** Shown after a valid submit. */
  doneText?: string;
  call?: string;
  /** Replaces the submit and clear buttons. */
  actions?: ReactNode;
  /** Replaces form.done, for forms that decide it themselves. */
  done?: boolean;
  /** Extra content under the result, e.g. what a server answered. */
  aside?: ReactNode;
  children: ReactNode;
};

/** A form next to the live result of validating its values. */
export const FormSheet = ({
  title,
  form,
  submitLabel,
  doneText = "Valid. The output on the yellow sheet is what would be sent.",
  call,
  actions,
  done,
  aside,
  children,
}: FormSheetProps) => (
  <div className="demo">
    <form className="sheet form-sheet" onSubmit={form.submit} noValidate>
      <h2 className="sheet-title">{title}</h2>
      <div className="fields">{children}</div>
      <div className="form-actions">
        {actions ?? (
          <>
            <button type="submit" className="button">
              {submitLabel}
            </button>
            <button type="button" className="button-plain" onClick={form.reset}>
              Clear the form
            </button>
          </>
        )}
      </div>
      {(done ?? form.done) && (
        <p className="form-done" role="status">
          {doneText}
        </p>
      )}
    </form>
    <div className="demo-side">
      <ResultSheets result={form.result} pending={form.pending} call={call} />
      {aside}
    </div>
  </div>
);
