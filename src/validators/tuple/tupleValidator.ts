import {
  AnyAsync,
  AnyValidator,
  appendIssues,
  childContext,
  Combinator,
  createState,
  ExtendedValidator,
  extendValidator,
  Infer,
  InferInput,
  runChildren,
  andThen,
  Validator,
} from "../../core/validator/index.ts";
import { issueWithMessage } from "../../core/rule.ts";
import { XOEIssue } from "../../core/validatorTypes.ts";
import { NoRules } from "../../core/types.ts";
import * as en from "../../core/english.ts";

export type TupleOutput<V extends readonly AnyValidator[]> = {
  -readonly [K in keyof V]: Infer<V[K]>;
};

export type TupleInput<V extends readonly AnyValidator[]> = {
  -readonly [K in keyof V]: InferInput<V[K]>;
};

export type TupleValidator<
  T,
  I = T,
  A extends boolean = false,
> = ExtendedValidator<
  T,
  NoRules,
  Record<never, never>,
  Record<never, never>,
  I,
  A
>;

const tupleCombinator = (
  items: readonly Validator<unknown>[],
  message: string | undefined,
): Combinator => ({
  meta: { kind: "tuple", items },
  get isAsync() {
    return items.some((item) => item.isAsync);
  },
  run: (value: unknown[], ctx, state) => {
    const issues: XOEIssue[] = [];
    if (value.length > items.length) {
      issues.push(
        issueWithMessage(
          "tuple.length",
          [state.errorMessage, message],
          en.tupleLength(items.length),
          ctx.path,
          { length: items.length },
        ),
      );
      if (state.abortEarly) return { value, issues };
    }

    const output: unknown[] = [];
    return andThen(
      runChildren(
        items,
        (item, index) =>
          item["~run"](value[index], childContext(ctx, index, ctx.data)),
        (_, result, index) => {
          if (result.issues.length > 0) appendIssues(issues, result.issues);
          // Missing optional items at the end are not added to the output.
          if (index < value.length || result.value !== undefined) {
            output[index] = result.value;
          }
        },
        ctx,
        state.abortEarly,
      ),
      () => ({ value: output, issues }),
    );
  },
});

/**
 * An array with one validator per position, e.g. tuple([xoe.number(), xoe.number()]).
 * Optional items at the end may be missing; extra items report "tuple.length".
 */
export const createTupleValidator = <
  const V extends readonly [AnyValidator, ...AnyValidator[]],
>(
  items: V,
  message?: string,
): TupleValidator<TupleOutput<V>, TupleInput<V>, AnyAsync<V[number]>> =>
  extendValidator<
    TupleOutput<V>,
    NoRules,
    Record<never, never>,
    Record<never, never>,
    TupleInput<V>,
    AnyAsync<V[number]>
  >({})(
    createState("tuple", Array.isArray, {
      // A frozen copy: changing the list passed in can't change the tuple.
      children: tupleCombinator(Object.freeze([...items]), message),
    }),
  );
