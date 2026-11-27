# Standard Schema

Every xoe validator implements [Standard Schema](https://standardschema.dev)
(the `~standard` property), so it can be passed directly to libraries that
accept any Standard Schema, e.g. TanStack Form, tRPC, Hono or the
react-hook-form standard resolver.

```ts
const result = await signUp["~standard"].validate(data);
// { value } or { issues: [{ message, path, code, params }] }
```

Sync validators answer synchronously, async ones with a promise. Issues are the
usual `XOEIssue` objects, which already have the `message` and `path` the spec
requires. The input and output types (`StandardSchemaV1.InferInput` /
`InferOutput`) are the same as `InferInput` / `Infer`, see
[Input and output](input-and-output.md).

Form libraries show `issue.message`, so pass a translated validator with
`localized` (see [Translations](translations.md#forms-and-standard-schema)):

```ts
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { localized, srMessages } from "@x-ops-easy/xoe-validator";

useForm({ resolver: standardSchemaResolver(localized(signUp, srMessages)) });
```
