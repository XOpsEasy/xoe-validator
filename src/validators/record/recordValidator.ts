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
  IsAsync,
  runChildren,
  andThen,
  Validator,
} from "../../core/validator/index.ts";
import { XOEData, XOEIssue } from "../../core/validatorTypes.ts";
import { issueWithMessage } from "../../core/rule.ts";
import { isPlainRecord, setOwn } from "../../core/ownProperties.ts";
import { NoRules } from "../../core/types.ts";
import * as en from "../../core/english.ts";

export type RecordValidator<
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

/** Keys limited to a known set (e.g. an enum) are optional in the output type. */
export type RecordOutput<K, V> = string extends K
  ? Record<string, V>
  : Partial<Record<K & PropertyKey, V>>;

/**
 * An issue of the key validator. It has the entry's path like value issues,
 * so params.recordKey tells it apart (and is its input with reportInput).
 */
const keyIssue = (issue: XOEIssue, key: string): XOEIssue => ({
  ...issue,
  params: { ...issue.params, recordKey: key },
});

const recordCombinator = (
  keyValidator: Validator<string> | undefined,
  valueValidator: Validator<unknown>,
): Combinator => ({
  meta: { kind: "record", key: keyValidator, value: valueValidator },
  get isAsync() {
    return Boolean(keyValidator?.isAsync) || valueValidator.isAsync;
  },
  run: (value: XOEData, ctx, { abortEarly, errorMessage }) => {
    const issues: XOEIssue[] = [];
    const output: XOEData = {};
    // Parsed key -> the input key that produced it first.
    const firstKeys = new Map<string, string>();

    const runEntry = ([key, entry]: [string, unknown]) => {
      const entryCtx = childContext(ctx, key, value);
      const parsedKey = keyValidator
        ? keyValidator["~run"](key, entryCtx)
        : { value: key, issues: [] };

      return andThen(parsedKey, (keyOutput) =>
        andThen(valueValidator["~run"](entry, entryCtx), (valueOutput) => ({
          value: [keyOutput.value, valueOutput.value],
          issues: [
            ...keyOutput.issues.map((issue) => keyIssue(issue, key)),
            ...valueOutput.issues,
          ],
        })),
      );
    };

    return andThen(
      runChildren(
        Object.entries(value),
        runEntry,
        ([key], entry) => {
          const [parsedKey, parsedValue] = entry.value as [unknown, unknown];
          const outputKey = String(parsedKey);
          appendIssues(issues, entry.issues);

          // A key validator that transforms keys (e.g. trim) can map two
          // input keys to one; report it instead of dropping a value.
          const first = firstKeys.get(outputKey);
          if (first !== undefined) {
            issues.push(
              issueWithMessage(
                "record.duplicateKey",
                [errorMessage],
                en.duplicateKey(outputKey),
                [...ctx.path, key],
                { key: outputKey, first },
              ),
            );
            return;
          }
          firstKeys.set(outputKey, key);
          setOwn(output, outputKey, parsedValue);
        },
        ctx,
        abortEarly,
      ),
      () => ({ value: output, issues }),
    );
  },
});

/** An object with any keys, e.g. record(xoe.number()) or record(xoe.enum(["a", "b"]), xoe.number()). */
export function createRecordValidator<V extends AnyValidator>(
  valueValidator: V,
): RecordValidator<
  Record<string, Infer<V>>,
  Record<string, InferInput<V>>,
  IsAsync<V>
>;
export function createRecordValidator<
  K extends Validator<string, unknown, boolean>,
  V extends AnyValidator,
>(
  keyValidator: K,
  valueValidator: V,
): RecordValidator<
  RecordOutput<Infer<K>, Infer<V>>,
  RecordOutput<InferInput<K>, InferInput<V>>,
  AnyAsync<K | V>
>;
export function createRecordValidator(
  first: AnyValidator,
  second?: AnyValidator,
  // oxlint-disable-next-line typescript/no-explicit-any
): RecordValidator<any, any, boolean> {
  const [keyValidator, valueValidator] = second
    ? [first, second]
    : [undefined, first];

  return extendValidator({})(
    // Plain objects only: a Map, Set or class instance has no entries to
    // read as a record (its data would be dropped).
    createState("object", isPlainRecord, {
      // With two arguments the first one validates keys (see the overloads).
      children: recordCombinator(
        keyValidator as Validator<string> | undefined,
        valueValidator,
      ),
    }),
  );
}
