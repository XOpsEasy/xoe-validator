import { createValidator, Validator } from "../../core/validator/index.ts";

// The lazy validators already expanded by the isAsync lookup in progress. A
// lazy validator is expanded once per lookup, so the lookup takes linear time
// in the size of the reference graph; the async rules of a lazy validator
// seen again were already counted where it was expanded first.
let expanded: Set<object> | undefined;

/**
 * Defers creating the validator until it is used, for recursive schemas:
 *
 *   const category: Validator<Category> = xoe.object({
 *     name: xoe.string(),
 *     children: xoe.array(xoe.lazy(() => category)),
 *   });
 */
export const createLazyValidator = <T, I = T, A extends boolean = boolean>(
  getValidator: () => Validator<T, I, A>,
): Validator<T, I, A> => {
  // The getter runs once, on first use, when recursive references exist; a
  // getter that builds a schema doesn't rebuild it on every validation.
  let validator: Validator<T, I, A> | undefined;
  const resolve = () => (validator ??= getValidator());
  // Validators never change, so the answer of a whole lookup is kept.
  let isAsync: boolean | undefined;

  return createValidator<T, I, A>(
    (value, ctx) => resolve()["~run"](value, ctx),
    {
      get isAsync() {
        if (isAsync !== undefined) return isAsync;
        if (expanded) {
          if (expanded.has(resolve)) return false;
          expanded.add(resolve);
          return resolve().isAsync;
        }
        // The first lazy validator of a lookup starts and ends it.
        expanded = new Set([resolve]);
        try {
          return (isAsync = resolve().isAsync);
        } finally {
          expanded = undefined;
        }
      },
      get isOptional() {
        return resolve().isOptional;
      },
    },
    { kind: "lazy", resolve },
  );
};
