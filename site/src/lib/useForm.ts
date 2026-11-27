// The form state used by the examples: about 100 lines, no form library.
// It keeps the raw values, validates them on every change and decides which
// messages are visible. All validation is the `validate` function you pass in.
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  toFieldErrors,
  type XOEIssue,
  type XOEResult,
} from "@xopseasy/xoe-validator";
import { getIn, setIn } from "./paths.ts";

export type FormResult<Output = unknown> = XOEResult<
  Output,
  readonly XOEIssue[]
>;

/** What a field component needs; paths are dotted ("items.0.price"). */
export type FieldApi = {
  get: (path: string) => unknown;
  set: (path: string, value: unknown) => void;
  touch: (path: string) => void;
  errors: (path: string) => readonly string[];
};

type Options<Values, Output> = {
  initial: Values;
  /** `schema.validate(values)`, or `schema.validateAsync(values, { signal })`. */
  validate: (
    values: Values,
    signal: AbortSignal,
  ) => FormResult<Output> | Promise<FormResult<Output>>;
  /** Called with the parsed output; may return issues from a server. */
  onValid?: (output: Output) => void | Promise<readonly XOEIssue[] | void>;
  /** Wait this long after the last change (for async checks). */
  delay?: number;
  /** Validate again when this changes, e.g. the language of the messages. */
  revalidateOn?: unknown;
};

const NO_ISSUES: readonly XOEIssue[] = [];

export const useForm = <Values extends object, Output = unknown>(
  options: Options<Values, Output>,
) => {
  const { initial, delay = 0, revalidateOn } = options;
  const [values, setValues] = useState(initial);
  const [result, setResult] = useState<FormResult<Output> | null>(null);
  const [pending, setPending] = useState(false);
  const [touched, setTouched] = useState<ReadonlySet<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [done, setDone] = useState(false);
  const [serverIssues, setServerIssues] = useState(NO_ISSUES);

  // The latest callbacks, so the effect below depends only on the values.
  const latest = useRef(options);
  useEffect(() => {
    latest.current = options;
  });

  // Validate on every change. A newer change aborts the validation in
  // progress: its result is ignored and async rules get the signal.
  useEffect(() => {
    const controller = new AbortController();
    const run = async () => {
      setPending(true);
      try {
        const next = await latest.current.validate(values, controller.signal);
        if (controller.signal.aborted) return;
        setResult(next);
        setPending(false);
      } catch (error) {
        // An aborted validateAsync rejects with the signal's reason.
        if (!controller.signal.aborted) throw error;
      }
    };
    const timer = setTimeout(run, delay);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [values, delay, revalidateOn]);

  const fieldErrors = useMemo(
    () => toFieldErrors(result?.type === "error" ? result.value : NO_ISSUES),
    [result],
  );
  const serverErrors = useMemo(
    () => toFieldErrors(serverIssues),
    [serverIssues],
  );

  const change = (next: Values) => {
    setValues(next);
    setServerIssues(NO_ISSUES);
    setDone(false);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    const { validate, onValid } = latest.current;
    const outcome = await validate(values, new AbortController().signal);
    setResult(outcome);
    if (outcome.type === "error") return;
    const issues = (await onValid?.(outcome.value)) ?? NO_ISSUES;
    setServerIssues(issues);
    setDone(issues.length === 0);
  };

  /** Hides the messages again, e.g. on the next step of a wizard. */
  const hideErrors = () => {
    setTouched(new Set());
    setSubmitted(false);
  };

  const reset = () => {
    change(initial);
    hideErrors();
  };

  return {
    values,
    /** The result of the last validation; null before the first one. */
    result,
    pending,
    /** The last submit was valid (and the server accepted it). */
    done,
    setValues: change,
    get: (path: string) => getIn(values, path),
    set: (path: string, value: unknown) => change(setIn(values, path, value)),
    touch: (path: string) => setTouched((paths) => new Set(paths).add(path)),
    /** A field shows its messages once it was left or the form was sent. */
    errors: (path: string): readonly string[] => [
      ...(submitted || touched.has(path) ? (fieldErrors[path] ?? []) : []),
      ...(serverErrors[path] ?? []),
    ],
    submit,
    hideErrors,
    reset,
  };
};

export type Form<Values extends object, Output = unknown> = ReturnType<
  typeof useForm<Values, Output>
>;
