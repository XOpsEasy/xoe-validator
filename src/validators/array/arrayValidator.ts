import {
  AnyValidator,
  appendIssues,
  childContext,
  Combinator,
  createState,
  ExtendedValidator,
  extendValidator,
  Infer,
  InferInput,
  IsAsync,
  runChildren,
  andThen,
  Validator,
} from "../../core/validator/index.ts";
import { XOEIssue } from "../../core/validatorTypes.ts";
import { ruleRegistry as arrayRules } from "./arrayRules.ts";

export type ArrayValidator<
  T,
  I = T,
  A extends boolean = false,
> = ExtendedValidator<
  T,
  typeof arrayRules,
  Record<never, never>,
  Record<never, never>,
  I,
  A
>;

const itemCombinator = (item: Validator<unknown>): Combinator => ({
  meta: { kind: "array", item },
  get isAsync() {
    return item.isAsync;
  },
  run: (value: unknown[], ctx, { abortEarly }) => {
    const issues: XOEIssue[] = [];
    const output: unknown[] = [];

    return andThen(
      runChildren(
        value,
        (element, index) =>
          item["~run"](element, childContext(ctx, index, ctx.data)),
        (_, result) => {
          if (result.issues.length > 0) appendIssues(issues, result.issues);
          output.push(result.value);
        },
        ctx,
        abortEarly,
      ),
      () => ({ value: output, issues }),
    );
  },
});

const copyCombinator: Combinator = {
  meta: { kind: "array" },
  isAsync: false,
  run: (value: unknown[]) => ({ value: [...value], issues: [] }),
};

export function createArrayValidator(): ArrayValidator<unknown[]>;
export function createArrayValidator<V extends AnyValidator>(
  item: V,
): ArrayValidator<Infer<V>[], InferInput<V>[], IsAsync<V>>;
export function createArrayValidator(
  item?: Validator<unknown>,
  // oxlint-disable-next-line typescript/no-explicit-any
): ArrayValidator<any, any, boolean> {
  return extendValidator(arrayRules)(
    createState("array", Array.isArray, {
      // Without an item validator the array is copied, never returned as is.
      children: item ? itemCombinator(item) : copyCombinator,
    }),
  );
}
