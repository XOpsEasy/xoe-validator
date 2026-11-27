# Async validation

`validate()` is synchronous; use `validateAsync()` for validators with async
rules (it also works for sync validators). Validators know whether they are
async, so `validate()` on an async one is a type error:

```ts
const signUp = xoe.object({
  email: xoe.string().email(),
  username: xoe.string().refineAsync(isFree),
});

signUp.validate(data); // type error: use validateAsync()
await signUp.validateAsync(data); // ok
signUp.pick("email").validate(data); // ok: no async fields left
```

`refineAsync`, `superRefineAsync`, async `transform` and `pipe` into an async
validator make a validator async; objects, arrays, tuples, records and unions
are async when any part is. Where the type can't know (a hand-written
`Validator<T>` for `lazy`, async rules added with `with()`), `validate()` is
allowed and throws `XOEUsageError` `ASYNC_IN_SYNC` at runtime.

```ts
const username = xoe
  .string()
  .minLength(3)
  .refineAsync(
    (value) => api.isUsernameFree(value),
    "Username is already taken.",
  );

await username.validateAsync("john");
```

## How async work runs

`validateAsync()` runs async work in parallel: object fields, array items,
record entries and the async rules of one value. Issues and output keep the
order of the schema. With `abortEarly()` they run one after another and stop at
the first issue, e.g. to avoid calling an API when a previous check failed.

- At most 10 async rules (`refineAsync`, ...) run at the same time across the
  whole value, so an array of 500 items doesn't send 500 requests at once.
  Change it per call: `validateAsync(data, { concurrency: 3 })`, or
  `{ concurrency: Infinity }` for no limit. Async `transform`/`default` are not
  limited.
- Async rules (`refineAsync`) of a value only run when its other rules passed,
  whatever the chain order: `xoe.string().email().refineAsync(isTaken)` never
  calls `isTaken` with an invalid email.
- `transform` and `default` may be async; `validateAsync()` waits for them and
  `validate()` throws.
- `union` tries its options in order, so an option whose async check rejects
  stops the union.

## Cancelling

Cancel a validation with `validateAsync(data, { signal })`, e.g. when the user
keeps typing: it rejects with the signal's reason (an `AbortError` by default),
queued async rules don't start, and running ones get the signal as
`refineAsync((value, data, { signal }) => fetch(url, { signal }))`.

## Failing checks

If an async check throws or rejects (e.g. the network is down),
`validateAsync()` rejects with that error instead of reporting an issue, and the
async checks still waiting for a free slot don't start. Catch it in the check to
turn it into a validation result:
`refineAsync((v) => api.isFree(v).catch(() => true))`.
