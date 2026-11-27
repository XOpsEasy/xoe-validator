// The list of examples. Every example is a folder with a Form.tsx (the
// default export is the demo) and the source files shown under it.
import { type ComponentType, lazy } from "react";
import type { SourceFile } from "../lib/content.ts";

export type Example = {
  slug: string;
  title: string;
  /** One sentence for the lists of examples. */
  summary: string;
  /** What the example shows; `code` in backticks. */
  notes: string[];
  /** Inputs worth trying. */
  tryIt: string[];
  /** Source files, in tab order; paths are relative to the folder. */
  files?: string[];
  /** Slugs of the docs pages that explain it. */
  docs: string[];
};

export type ExampleGroup = { title: string; examples: Example[] };

const DEFAULT_FILES = ["schema.ts", "Form.tsx"];

export const exampleGroups: ExampleGroup[] = [
  {
    title: "Basics",
    examples: [
      {
        slug: "single-value",
        title: "One value",
        summary:
          "Validate an email, a number or a date on its own, without an object.",
        notes: [
          "Every validator validates one value: `xoe.string().email().validate(value)`.",
          'The result is `{ type: "success", value }` with the parsed output, or `{ type: "error", value }` with a list of issues. Invalid data never throws.',
          "An issue is data: a `code`, a `message`, `params` and a `path`.",
        ],
        tryIt: [
          "Email: the spaces and capitals are gone from the output.",
          "Password: `secret` breaks two rules, and both are reported.",
          "Date of birth: `2024-02-30` doesn't exist, so it is a `type` issue.",
        ],
        files: ["validators.ts", "Form.tsx"],
        docs: ["single-values", "validators", "errors"],
      },
      {
        slug: "login",
        title: "Login form",
        summary:
          "The smallest form: an object schema, required fields and a default.",
        notes: [
          "`xoe.object({...})` validates every field and collects all issues.",
          'Fields are required by default. An empty input (`""`) reports `required`.',
          "`trim()` and `toLowerCase()` change the value before the rules run, and the output keeps the change.",
          "`Infer<typeof loginSchema>` is the type of the output.",
        ],
        tryIt: [
          "Send the empty form: both fields report `required`.",
          "Type `  ANA@Example.com ` as the email and look at the output.",
        ],
        docs: ["objects", "methods", "input-and-output"],
      },
      {
        slug: "wiring",
        title: "A form without helpers",
        summary:
          "Plain React state, validate() and toFieldErrors(), and the hook the other examples use.",
        notes: [
          '`toFieldErrors(issues)` groups the messages by field: `{ email: ["..."] }`.',
          "Validation is synchronous and fast, so it can run on every render.",
          "The second tab is `useForm.ts`, the small hook behind the other examples. It adds async validation with cancelling, messages after blur, and issues from a server.",
        ],
        tryIt: [
          "Type `17` as the age: `coerce.number()` makes it a number, `minimum(18)` rejects it.",
        ],
        files: ["Form.tsx", "../../lib/useForm.ts"],
        docs: ["errors", "single-values"],
      },
      {
        slug: "sign-up",
        title: "Sign-up with an async check",
        summary:
          "Matching passwords, a minimum age, and a username checked against an API.",
        notes: [
          "`refineAsync` makes the schema async. `validate()` is then a type error and `validateAsync()` is used.",
          "The async check runs only after the other rules of the username passed, so short names never reach the API.",
          "`validateAsync(values, { signal })` cancels the check when the user keeps typing.",
          '`sameAs("password")` compares with a sibling field. `minAge(18)` compares a date of birth with today.',
        ],
        tryIt: [
          "Username `marko` is taken. `ma` is too short and is never sent to the API.",
          "A password `short` reports two issues.",
          "Pick a date of birth less than 18 years ago.",
        ],
        docs: ["async", "methods", "validators"],
      },
      {
        slug: "profile",
        title: "Optional fields and defaults",
        summary:
          "What an empty input means: optional(), default() and transform().",
        notes: [
          '`undefined`, `null` and `""` count as empty. `optional()` lets them pass, and a value is still validated.',
          "`default(value)` replaces an empty value, so the output always has the field.",
          "`transform(fn)` maps the valid value to the output.",
          "`validator.isOptional` tells the form which fields to mark as optional.",
        ],
        tryIt: [
          "Fill in only the name and the handle: the optional fields are left out of the output.",
          "Type `@Ana_M` as the handle.",
          "Type `example.com` as the website: optional, but a value must be a URL.",
        ],
        docs: ["methods", "input-and-output"],
      },
      {
        slug: "search-filters",
        title: "Search filters from a URL",
        summary:
          "Query parameters are strings: coerce them, and fall back when they are wrong.",
        notes: [
          "`xoe.coerce.number()`, `.boolean()` and `.date()` convert strings before validating.",
          "`catch(fallback)` returns the fallback instead of an issue: `page=abc` becomes `1`.",
          "Keys that are not in the schema are removed from the output.",
        ],
        tryIt: [
          "The start value has a wrong page and page size, and still gives an output.",
          "Add `&since=2024-02-30`: the date has no `catch`, so it is reported.",
        ],
        docs: ["input-and-output", "methods"],
      },
    ],
  },
  {
    title: "Fields that depend on each other",
    examples: [
      {
        slug: "booking",
        title: "Booking with a date range",
        summary:
          "Rules over several fields, and a field that is required only sometimes.",
        notes: [
          "A rule over several fields is a `refine` of the object, with a `path` to the field that shows the message.",
          "Object refinements get the parsed values (`Date`, `number`) and run only when every field is valid.",
          "A sometimes-required field is `optional()` plus a `refine` with the code `required`.",
        ],
        tryIt: [
          "Choose a check-out before the check-in.",
          "Tick the company box and leave the VAT number empty.",
          "Book more than 14 nights.",
        ],
        docs: ["objects", "methods"],
      },
      {
        slug: "payment",
        title: "Payment methods",
        summary:
          "A different set of fields per method, and a card number rule of your own.",
        notes: [
          '`discriminatedUnion("method", {...})` validates only the fields of the selected method and removes the others from the output.',
          "`createRule` makes a rule with its own code, and `xoe.string.extend({ cardNumber })` makes it a method.",
          "`transform(...).pipe(...)` cleans a value first (spaces in a card number) and validates the result.",
        ],
        tryIt: [
          "Card `4242 4242 4242 4242` passes, `4242 4242 4242 4241` fails the check digit.",
          "Fill in the card, switch to PayPal and look at the output.",
          "An expiry date in the past, e.g. `01/20`.",
        ],
        docs: ["unions-and-records", "custom-rules", "composing"],
      },
      {
        slug: "wizard",
        title: "Multi-step form",
        summary:
          "A loan application in four steps, each validated before the next.",
        notes: [
          "The whole form is an object of its steps. A step is validated with `applicationSchema.pick(key)`.",
          'Issues have the same paths in a step and in the whole form: `["loans", "loanAmount"]`.',
          "A branch (a person or a company) is a `discriminatedUnion`. A follow-up question is an `optional()` field with a `refine`.",
        ],
        tryIt: [
          "Press Next on an empty step.",
          "In step 2, switch between a person and a company.",
          "In step 3, tick the box and leave the amount empty.",
        ],
        docs: ["multi-step-forms", "objects"],
      },
    ],
  },
  {
    title: "Lists, files and nested data",
    examples: [
      {
        slug: "invoice",
        title: "Invoice lines",
        summary:
          "A list of rows that grows and shrinks, with rules for a row and for the list.",
        notes: [
          '`xoe.array(line)` validates every row. An issue has the path of its row: `["lines", 1, "price"]`, or `lines.1.price` in `toFieldErrors`.',
          '`nonEmpty`, `maxLength` and `uniqueBy("sku")` are rules of the list itself.',
          "`maxDecimals(2)` checks amounts without floating point surprises.",
        ],
        tryIt: [
          "Use the same SKU twice (`lmp-001` counts: it is upper-cased first).",
          "Type `9.999` as a price.",
          "Remove every line.",
        ],
        docs: ["validators", "objects", "errors"],
      },
      {
        slug: "team-invite",
        title: "A list in one text field",
        summary: "Comma-separated emails become a validated array.",
        notes: [
          "`transform` splits the text and `pipe` validates the array that comes out.",
          "`unique()` reports duplicates. The addresses are lower-cased first, so `Ana@` and `ana@` are the same.",
          "`roleSchema.options` are the values of the enum, used for the select.",
        ],
        tryIt: [
          "The start value has a broken address. Fix it, and the duplicate is reported: rules of a list run once its items are valid.",
          "Add a sixth address.",
        ],
        docs: ["composing", "unions-and-records"],
      },
      {
        slug: "file-upload",
        title: "File upload",
        summary: "Check the type and size of files before sending them.",
        notes: [
          "`xoe.file()` validates `File` objects, in the browser and in Node.",
          '`accept(["image/*", ".pdf"])` takes the same patterns as the HTML `accept` attribute.',
          "A file input without a selection counts as empty.",
        ],
        tryIt: [
          "Send without a cover image.",
          "Choose a text file as the cover, or a file over 1 MB.",
          "Choose four attachments.",
        ],
        docs: ["validators"],
      },
      {
        slug: "price-list",
        title: "Records and tuples",
        summary: "Prices per currency and a size of three numbers.",
        notes: [
          "`xoe.record(keys, values)` validates an object with unknown keys. With an enum as the key validator, the keys are limited to its values.",
          "`xoe.tuple([...])` validates each position of a fixed-length array.",
          "The form removes empty prices before validating: an empty input isn't a price.",
        ],
        tryIt: [
          "Leave all three prices empty.",
          "Type `12.345` as a price, and `0` as the width.",
        ],
        docs: ["unions-and-records", "validators"],
      },
      {
        slug: "category-tree",
        title: "A recursive tree",
        summary: "Categories inside categories, validated at every depth.",
        notes: [
          "`xoe.lazy(() => categorySchema)` lets a schema refer to itself.",
          "A recursive schema needs a type annotation: `Validator<Category>`.",
          "Issue paths go as deep as the data: `children.0.children.0.name`.",
        ],
        tryIt: [
          "The start value has a name that is too short. Fix it, and the two siblings with the same name are reported: rules of a list run once its items are valid.",
          "Add a fourth subcategory to one level.",
        ],
        docs: ["unions-and-records"],
      },
      {
        slug: "json-import",
        title: "Importing a JSON file",
        summary:
          "Parse text as JSON and validate what it holds, without try/catch.",
        notes: [
          "`transform(JSON.parse)` that throws is reported as an issue with the code `transform`.",
          "`pipe(settingsSchema)` validates the parsed value.",
          "`strict()` reports unknown keys, such as a misspelled one.",
        ],
        tryIt: [
          "Fix the three problems one by one.",
          "Delete a closing brace.",
        ],
        docs: ["composing", "objects"],
      },
    ],
  },
  {
    title: "Messages and servers",
    examples: [
      {
        slug: "serbian-company",
        title: "Serbian IDs and translated messages",
        summary:
          "PIB, matični broj and JMBG with check digits, in Serbian or English.",
        notes: [
          "`rsRules` checks the check digits of Serbian identifiers. `xoe.string.extend(rsRules)` makes them methods.",
          "`localizeIssues(issues, srMessages)` translates the issues, with plural forms.",
          'A catalog is a plain object: add `"<field>:<code>"` for the message of one field.',
        ],
        tryIt: [
          "Switch the language with issues on the page.",
          "Change the last digit of the PIB `101134702`.",
          "Type `300` employees and compare the two languages.",
        ],
        files: ["schema.ts", "messages.ts", "Form.tsx"],
        docs: ["country-rules", "translations"],
      },
      {
        slug: "server-issues",
        title: "Issues from the server",
        summary:
          "One schema in the browser and on the server, and server issues on the form fields.",
        notes: [
          "The browser and the server import the same schema.",
          "Issues are plain data, so a 400 response carries them as JSON.",
          "A check only the server can do (a taken name) returns an issue in the same format, and the form shows it by its `path`.",
        ],
        tryIt: [
          "Send `acme`: valid in the browser, taken on the server.",
          "Tick the last box, empty the email and send: the server reports it.",
        ],
        files: ["schema.ts", "server.ts", "Form.tsx"],
        docs: ["errors", "translations"],
      },
    ],
  },
  {
    title: "Other tools",
    examples: [
      {
        slug: "react-hook-form",
        title: "react-hook-form",
        summary: "Pass a schema to the Standard Schema resolver.",
        notes: [
          "Every validator implements Standard Schema, so `standardSchemaResolver(schema)` works without an xoe adapter.",
          "`handleSubmit` receives the parsed output.",
          "For translated messages, wrap the schema: `localized(schema, srMessages)`.",
        ],
        tryIt: ["Leave a field and come back: the messages show after blur."],
        docs: ["standard-schema", "translations"],
      },
      {
        slug: "json-schema-form",
        title: "A form from a JSON Schema",
        summary:
          "Draw the fields from a JSON Schema and validate with the same schema.",
        notes: [
          "`xoe.jsonSchema(schema)` builds a validator from a JSON Schema, with the usual issues.",
          "The output type is inferred from a schema written `as const`.",
          'JSON Schema semantics apply inside it: `""` is a value and nothing is coerced.',
        ],
        tryIt: ["Type `1.5` as the estimate.", "Type `1.2` as the version."],
        docs: ["json-schema"],
      },
      {
        slug: "openapi",
        title: "JSON Schema and OpenAPI output",
        summary: "Describe a validator as JSON Schema for API documentation.",
        notes: [
          "`toJsonSchema(validator)` writes JSON Schema draft 2020-12, the dialect of OpenAPI 3.1.",
          '`{ target: "openapi-3.0" }` writes the older OpenAPI 3.0 form.',
          "`meta()` and `describe()` add titles, descriptions and examples.",
        ],
        tryIt: ["Switch the target and compare `website` and `age`."],
        docs: ["to-json-schema"],
      },
    ],
  },
];

export const examples = exampleGroups.flatMap((group) => group.examples);

export const findExample = (slug: string) =>
  examples.find((example) => example.slug === slug);

const forms = import.meta.glob<{ default: ComponentType }>("./*/Form.tsx");
const sources = import.meta.glob<SourceFile>(
  ["./*/*.{ts,tsx}", "../lib/useForm.ts"],
  { query: "?code", import: "default" },
);

const components = new Map<string, ComponentType>();

/** The demo of an example, loaded when it is first shown. */
export const exampleComponent = (slug: string): ComponentType => {
  const component = components.get(slug) ?? lazy(forms[`./${slug}/Form.tsx`]);
  components.set(slug, component);
  return component;
};

const sourceKey = (slug: string, file: string) =>
  file.startsWith("../../") ? file.slice(3) : `./${slug}/${file}`;

const loaded = new Map<string, Promise<SourceFile[]>>();

/** The highlighted source files of an example. */
export const exampleSources = (example: Example): Promise<SourceFile[]> => {
  const files = example.files ?? DEFAULT_FILES;
  const promise =
    loaded.get(example.slug) ??
    Promise.all(files.map((file) => sources[sourceKey(example.slug, file)]()));
  loaded.set(example.slug, promise);
  return promise;
};
