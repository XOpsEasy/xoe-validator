# Translations

`localizeIssues(issues, messages)` returns the issues with messages from a
catalog. It is a pure function, so you can pick the catalog per request
(backend) or per locale (frontend), also for issues received from an API.

## Built-in catalogs

Catalogs for English (`enMessages`) and Serbian Latin (`srMessages`) cover every
issue code of the built-in validators, with plural forms ("1 karakter", "3
karaktera", "5 stavki"), local number formats ("0,5") and dates in the runtime's
time zone ("15.01.2024."). Bundlers leave out the ones you don't import.

The default messages are the English ones of `enMessages` ("Must be at least 1
character long.", "Must be before 2024-01-15."), so English apps don't need
`localizeIssues`. Use `enMessages` to switch back to English or as a base for
your own catalog.

```ts
import { localizeIssues, srMessages } from "@xopseasy/xoe-validator";

localizeIssues(result.value, srMessages);
// [{ code: "string.minLength", message: "Tekst mora imati najmanje 3 karaktera.", ... }]

// Catalogs are plain objects: override or add entries.
const messages = { ...srMessages, required: "Obavezno." };
```

## Forms and Standard Schema

Libraries that show `issue.message` themselves, such as form resolvers
(react-hook-form, TanStack Form) or tRPC, can't call `localizeIssues`.
`localized(validator, messages)` returns the validator with translated messages
in `validate`, `validateAsync` and the Standard Schema interface; its types,
validation and `toJsonSchema` don't change.

```ts
import { localized, srMessages } from "@xopseasy/xoe-validator";

const signUpSr = localized(signUp, srMessages);

// A function reads the catalog on every validation, e.g. the app's language:
const resolver = standardSchemaResolver(
  localized(signUp, () => messages[lang]),
);
```

Create the schema once and wrap it where the language is known; the wrapper is
cheap.

## Which messages are translated

Messages you pass in are kept: rule arguments (`minLength(3, "...")`),
`required("...")`, `errorMessage("...")`, and the messages of `literal`, `enum`,
`instanceOf`, `union`, `strict` and `sameAs`. Their issues have
`customMessage: true`, which also survives JSON, so a frontend can localize
issues from an API. Without a message, the same rules are translated.

Your own rules (`refine`, `superRefine`, `createRule`) define codes: their
messages are the defaults of those codes, translated when your catalog has an
entry (`"booking.dateRange": "..."`). Code `custom` is in no built-in catalog,
so `refine(check, "...")` messages stay as written.

This also applies when your rule reuses a built-in code, e.g. a conditionally
required field:

```ts
const customer = xoe
  .object({
    isCompany: xoe.boolean(),
    vatNumber: xoe.string().optional(),
  })
  .refine((value) => !value.isCompany || Boolean(value.vatNumber), {
    code: "required", // treated like any required field, e.g. by the UI
    message: "VAT number is required for companies.",
    path: ["vatNumber"],
  });

localizeIssues(issues, srMessages); // "Polje je obavezno." (srMessages.required)
```

To keep a specific message, add a field key to the catalog
(`{ ...srMessages, "vatNumber:required": "PIB je obavezan za firme." }`), or use
a code of your own (`code: "vatNumber.required"`), which no built-in catalog
translates.

## Your own catalog

```ts
import {
  localizeIssues,
  toFieldErrors,
  XOEMessages,
} from "@xopseasy/xoe-validator";

const sr: XOEMessages = {
  required: "Polje je obavezno.",
  "string.minLength": "Unesite najmanje {min} karaktera.",
  "number.between": "Vrednost mora biti između {min} i {max}.",
  "pin:string.length": "PIN mora imati {length} cifre.", // only for the "pin" field
  "string.email": (issue) => `Neispravan email (${issue.path.join(".")}).`,
};

if (result.type === "error") {
  toFieldErrors(localizeIssues(result.value, sr));
}
```

- Keys are issue codes, or `"<path>:<code>"` for one field; the field key wins.
- `{param}` placeholders are filled from `issue.params` (arrays are joined with
  `,`, dates are ISO strings). Unknown placeholders are left as is. For type
  issues: `type: "Očekivan {expected}, dobijen {received}."`.
- Issues without a catalog entry, and issues with `customMessage`, keep their
  message.
