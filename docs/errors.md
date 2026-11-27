# Issues and errors

Validation never throws on invalid data. It returns an `XOEResult` with a list
of issues:

```ts
type XOEIssue = {
  code: string; // "string.minLength", "required", "type", "custom", ...
  message: string; // default or custom message
  params?: Record<string, unknown>; // { min: 3 }, useful for translations
  path: (string | number)[]; // [] for the value itself, ["user", "email"], ["tags", 1]
  input?: unknown; // the invalid value, only with { reportInput: true }
  customMessage?: true; // the message was passed in, see Translations
};
```

Issues are plain, immutable data, so they can be sent from an API and localized
on the frontend ([Translations](translations.md)).

## Field errors

`toFieldErrors(issues)` groups the messages by field, e.g. for a form:

```ts
const result = signUp.validate(data);
if (result.type === "error") {
  toFieldErrors(result.value);
  // { name: ["..."], confirmPassword: ["Passwords do not match"], "tags.1": ["..."] }
}
```

Keys are dotted paths (`"user.email"`, `"tags.1"`); `""` is the validated value
itself. Duplicate messages of the same field are merged.

## Type issues

Type issues (code `type`) have `params: { expected, received }`, e.g.
`{ expected: "number", received: "string" }`. `received` is only the name of the
type (`"null"`, `"array"`, `"nan"`, `"invalid date"`, ...), never the value, so
it's safe to log and to return from an API.

## Reporting the input

To see the invalid values themselves, e.g. while debugging or in internal logs,
validate with `{ reportInput: true }`: every issue gets `input`, the value at
its path as it was passed in (before `coerce` or `trim`):

```ts
form.validate(body, { reportInput: true });
// [{ code: "number.minimum", path: ["age"], input: "17", ... }]
```

It's off by default because inputs may hold passwords, tokens or personal data:
don't send issues with `input` to clients or to third-party logging.

## Usage errors

Invalid data never throws; it is reported as issues. Using the library
incorrectly throws an `XOEUsageError` with a `code`:

| Code                  | When                                                                     |
| --------------------- | ------------------------------------------------------------------------ |
| `ASYNC_IN_SYNC`       | `validate()` on a validator with async rules, transforms or defaults     |
| `INVALID_CONCURRENCY` | `validateAsync(value, { concurrency })` below 1                          |
| `NAME_CONFLICT`       | a custom rule named like a built-in method (`extend`, `defineValidator`) |
| `INVALID_SCHEMA`      | `xoe.jsonSchema()` with an invalid schema (`type`, `pattern`, `$ref`)    |
| `UNCOPYABLE_VALUE`    | a `default()`/`catch()` object that can't be copied                      |
| `UNREPRESENTABLE`     | `toJsonSchema()` with a validator JSON Schema can't describe             |

To work with results (`map`, `flatMap`, ...), see
[Working with results](results.md).
