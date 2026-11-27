# Validators and rules

| Validator            | Rules                                                                                                                                                     |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `xoe.string()`       | `minLength`, `maxLength`, `length`, `regexMatch`, `contains`, `startsWith`, `endsWith`, `email`, `url`, `uuid`, `date`, `dateTime`, `ip`, `digits`        |
| `xoe.number()`       | `minimum`, `maximum`, `between`, `greaterThan`, `lessThan`, `divisibleBy`, `integer`, `safeInteger`, `maxDecimals`, `positive`, `nonNegative`, `negative` |
| `xoe.boolean()`      | `isTrue`                                                                                                                                                  |
| `xoe.date()`         | `isBefore`, `isAfter`, `between`, `inFuture`, `inPast`, `minAge`, `maxAge`                                                                                |
| `xoe.object(shape?)` | `requireOne`, `strict`, `passthrough`, `catchall`, `pick`, `omit`, `partial`, `requiredFields`, `extend`, `keyof`, see [Objects](objects.md)              |
| `xoe.array(item?)`   | `minLength`, `maxLength`, `length`, `nonEmpty`, `unique`, `uniqueBy`                                                                                      |
| `xoe.file()`         | `maxSize`, `minSize`, `accept`                                                                                                                            |

Error codes are `<validator>.<rule>`, e.g. `string.email`, `number.between`.
Every rule accepts an optional custom message as its last argument.

Literals, enums, unions, records and recursive schemas are described in
[Unions, records and recursion](unions-and-records.md); methods available on
every validator (`optional`, `refine`, `default`, ...) in
[Common methods](methods.md).

## Rule notes

- `email` is a basic format check (`name@domain.tld`), not a full RFC 5322
  parser.
- `url(protocols?)` accepts only `http` and `https` by default, so values such
  as `javascript:...` are rejected. Control characters (e.g. `"\r\n"`) and
  spaces at the start or end are rejected too: the URL parser would drop them,
  but the value is returned as it is.
- `uuid` accepts versions 1-8 (case insensitive).
- `between` (number and date) is inclusive; `isBefore`/`isAfter` are exclusive.
- `inFuture`/`inPast` compare with the time of validation. Pass a clock for
  deterministic results, e.g. in tests:
  `inFuture({ now: () => new Date("2030-01-01"), message: "..." })`.
- `regexMatch` uses its own copy of the pattern, so a `/g` or `/y` RegExp you
  pass in is never changed and every call gives the same result.
- Array `maxLength` is checked before the items: a too long array reports only
  `array.maxLength` and its items aren't validated, which also bounds the work
  for large untrusted input.
- `unique` compares elements with `===`; use `uniqueBy("id")` or
  `uniqueBy(item => ...)` for objects. Elements without the key (or for which
  the selector returns `undefined`) count as equal, so two of them are reported
  as duplicates.
- `date()` is an ISO date (`"2024-05-01"`) that exists: `"2024-02-30"` fails.
  `dateTime()` is an ISO 8601 / RFC 3339 date and time with an offset
  (`"2024-05-01T10:00:00Z"`, `"...+02:00"`); `dateTime({ local: true })` takes
  the value of `<input type="datetime-local">` (`"2024-05-01T10:00"`, no
  offset). Both keep the string; use `xoe.coerce.date()` for a `Date`.
- `ip()` accepts IPv4 and IPv6, `ip(4)` / `ip(6)` only one of them. IPv4 parts
  have no leading zeros (`"01.2.3.4"` fails), IPv6 zone IDs (`%eth0`) are
  rejected.
- `digits()` accepts only `0`-`9` (PINs, postal codes); no sign, spaces or other
  scripts' digits.
- `greaterThan`/`lessThan` are exclusive, `minimum`/`maximum` inclusive.
- `maxDecimals(2)` counts decimal places, e.g. for amounts. Unlike
  `divisibleBy(0.01)` it isn't affected by floating point (`0.29 % 0.01` isn't
  `0`). `maxDecimals(0)` is the same as `integer()`.
- `safeInteger()` is a whole number that JavaScript represents exactly
  (`Number.MAX_SAFE_INTEGER`), e.g. for IDs.
- `minAge(18)` / `maxAge(65)` compare a birth date with the time of validation,
  by the calendar in the runtime's time zone: someone turns 18 on their
  birthday, and someone born on 29 February has their birthday on 1 March in
  other years. A birth date at UTC midnight is a date without a time
  (`xoe.coerce.date()` of `"2008-11-04"`, `valueAsDate` of
  `<input type="date">`), so its UTC day counts in every time zone. They take
  `{ now, message }` like `inFuture`.
- `minLength`, `maxLength` and `length` count UTF-16 code units, like
  JavaScript's `String.length`: an emoji or some other characters count as 2.
  For limits on visible characters, count graphemes in a `refine`:

  ```ts
  const graphemes = (text: string) =>
    [...new Intl.Segmenter().segment(text)].length;

  xoe.string().refine((v) => graphemes(v) <= 20, {
    message: "At most 20 characters",
    code: "string.maxGraphemes",
  });
  ```

## Strings

`trim()`, `toLowerCase()` and `toUpperCase()` change the input before it is
validated, so the rules see the result and it is the output:

```ts
xoe.string().trim().toLowerCase().email(); // "  Ana@Example.COM " -> "ana@example.com"
xoe.string().trim().toUpperCase().startsWith("RS"); // "rs123" -> "RS123"
```

`trim()` also makes `"   "` count as empty.

## Other types

```ts
xoe.unknown(); // any present value (unknown), e.g. JSON payloads
xoe.tuple([xoe.number(), xoe.number()]); // [number, number]
xoe.instanceOf(URL); // URL instances
xoe
  .file()
  .accept(["image/*", ".pdf"])
  .maxSize(2 * 1024 * 1024); // File
```

- `tuple` validates each position; optional items at the end may be missing,
  extra items report `tuple.length`.
- `file` accepts `File` objects (browsers, Node 20+), e.g. from
  `FormData`. `accept` takes MIME types, groups (`image/*`) and extensions
  (`.pdf`), as the HTML `accept` attribute. A file input without a selection
  sends an empty, unnamed `File`; it counts as empty, so required fields report
  `required`.

Rules for identifiers of a country (Serbia: JMBG, PIB, company number) are in
[Country rules](country-rules.md). To add rules or new types, see
[Custom rules and types](custom-rules.md).
