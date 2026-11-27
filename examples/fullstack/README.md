# Fullstack example

A React frontend and a Hono backend that share their xoe-validator schemas
(`shared/schemas.ts`): one definition, the same rules and messages on both
sides.

| Where                          | What it shows                                                                                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shared/schemas.ts`            | sign-up (async username check passed in per side), company (Serbian rules), order, query, import                                                        |
| `shared/application.ts` | a loan application in four steps: a key per step, a step validated with `pick`, a branch and a follow-up question |
| `backend/app.ts`               | Hono routes that answer 400 with the issues as data, `validateAsync` with the request's signal, OpenAPI from `toJsonSchema`                             |
| `frontend/src/SignUpForm.tsx`  | react-hook-form with xoe through Standard Schema (`standardSchemaResolver`), server issues on the fields                                                |
| `frontend/src/CompanyForm.tsx` | xoe used directly, Serbian and English messages with `localizeIssues`                                                                                   |
| `frontend/src/StepForm.tsx` | a multi-step form with react-hook-form: the steps as a list, the current step's schema before "Next", server issues on their step ([recipe](../../docs/multi-step-forms.md)) |
| `scenarios.test.ts`            | the API scenarios a client goes through, without a server (`app.request`)                                                                               |

It has its own `package.json`: the library's CI never installs or runs it.

## Run it

The example uses the library from this repository (`file:../..`), so build the
library first:

```sh
# in the repository root
npm ci && npm run build

# in examples/fullstack
npm install
npm run dev     # API on :3001, frontend on http://localhost:5173
npm test        # API scenarios, type check and frontend build
```

After changing the library, run `npm run build` in the root again; the example
picks the new build up.
