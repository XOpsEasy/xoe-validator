# Country rules

Rules for identifiers of one country, with their check digits. They are rule
registries, like `stringRules`: add them with `with()`, or make them methods
with `extend()`. Bundlers leave out the ones you don't import.

The values are strings of digits: leading zeros matter, so validate them with
`xoe.string()`, not as numbers. JSON Schema can describe their length but not
their check digit, so `toJsonSchema` gives a `pattern` such as `^[0-9]{13}$`.

## Serbia (`rsRules`)

| Rule              | Identifier                                                          | Code               |
| ----------------- | ------------------------------------------------------------------- | ------------------ |
| `jmbg()`          | JMBG (jedinstveni matični broj građana), the personal ID: 13 digits | `rs.jmbg`          |
| `pib()`           | PIB (poreski identifikacioni broj), the tax ID: 9 digits            | `rs.pib`           |
| `companyNumber()` | Matični broj (MB) of a company or sole trader: 8 digits             | `rs.companyNumber` |

```ts
import xoe, { rsRules } from "@xopseasy/xoe-validator";

// As rules:
const jmbg = xoe.string().trim().with(rsRules.jmbg());

// As methods:
const string = xoe.string.extend(rsRules);
const company = xoe.object({
  pib: string().trim().pib(),
  companyNumber: string().trim().companyNumber(),
  director: string().trim().jmbg("Unesite ispravan JMBG direktora."),
});
```

- `jmbg()` checks that the date of birth exists (the year has three digits:
  `990` is 1990, `005` is 2005) and the check digit by modulo 11. A remainder of
  1 is never issued, so such numbers are invalid whatever their last digit.
- `pib()` checks the check digit by ISO 7064 MOD 11,10.
- `companyNumber()` checks the check digit by modulo 11 with the weights 2-7
  from the right; a result of 10 or 11 gives 0.
- They don't check that a number was actually issued (only an official register
  knows that).

The messages are in `enMessages` (the default messages) and `srMessages`, like
every other rule.

## Naming

Rules of a country are in a registry named by its ISO code (`rsRules`), and
their codes have its prefix (`rs.jmbg`). They use the official abbreviation of
an identifier when there is one in use (`jmbg`, `pib`, like `cpf` or `ssn` in
other countries), and an English description otherwise (`companyNumber`).
