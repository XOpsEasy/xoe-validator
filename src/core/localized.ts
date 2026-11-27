import { createValidator, andThen, type Validator } from "./validator/index.ts";
import { localizeIssues, type XOEMessages } from "./messages.ts";

/**
 * The validator with translated messages: validate, validateAsync and the
 * Standard Schema interface ("~standard") return issues with messages from
 * the catalog. For libraries that only show issue.message, e.g. form
 * resolvers (react-hook-form, TanStack Form, ...).
 *
 * Pass a function to read the catalog on every validation, e.g. the current
 * language of the app:
 *
 *   standardSchemaResolver(localized(signUp, () => messages[lang]))
 *
 * Validation, types and toJsonSchema are the same as of the validator.
 */
export const localized = <T, I, A extends boolean>(
  validator: Validator<T, I, A>,
  messages: XOEMessages | (() => XOEMessages),
): Validator<T, I, A> => {
  const catalog = typeof messages === "function" ? messages : () => messages;
  return createValidator<T, I, A>(
    (value, ctx) =>
      andThen(validator["~run"](value, ctx), (output) =>
        output.issues.length === 0
          ? output
          : {
              value: output.value,
              issues: [...localizeIssues(output.issues, catalog())],
            },
      ),
    validator,
    { kind: "context", inner: validator },
  );
};
