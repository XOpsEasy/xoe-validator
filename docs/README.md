# Documentation

Start with the [README](../README.md) for installation and a first example.
Coming from Zod? See [Migrating from Zod](migrating-from-zod.md). See
[examples/fullstack](../examples/fullstack) for a frontend and a backend sharing
their schemas.

## Validating values

- [Validators and rules](validators.md) - strings, numbers, dates, arrays, files
  and their rules
- [Validating single values](single-values.md) - one value, one rule, fields at
  different times
- [Objects](objects.md) - unknown keys, `pick`/`omit`/`partial`/`extend`,
  cross-field validation
- [Unions, records and recursion](unions-and-records.md) - `literal`, `enum`,
  `union`, `discriminatedUnion`, `record`, `lazy`
- [Common methods](methods.md) - `optional`, `nullable`, `default`, `catch`,
  `refine`, `transform`, ...
- [Input and output](input-and-output.md) - `Infer`/`InferInput`, coercion,
  validation order
- [Composing validators](composing.md) - shared rules with `with`, `pipe`
- [Async validation](async.md) - `validateAsync`, concurrency, cancelling
- [Multi-step forms](multi-step-forms.md) - a key per step, branches, follow-up
  questions, server issues on their step

## Errors and results

- [Issues and errors](errors.md) - the issue format, `toFieldErrors`,
  `reportInput`, usage errors
- [Working with results](results.md) - `map`, `flatMap`, `tryCatch`, ...
- [Translations](translations.md) - `localizeIssues`, English and Serbian
  catalogs

## Extending and integrating

- [Country rules](country-rules.md) - Serbia: `jmbg`, `pib`, `companyNumber`
- [Custom rules and types](custom-rules.md) - `createRule`, `extend`,
  `defineValidator`
- [Validating with JSON Schema](json-schema.md) - `xoe.jsonSchema`, OpenAPI
  documents, inferred types
- [From xoe to JSON Schema](to-json-schema.md) - `toJsonSchema` for OpenAPI and
  other tools
- [Standard Schema](standard-schema.md) - TanStack Form, tRPC, Hono, ...
