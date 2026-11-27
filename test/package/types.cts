// A CommonJS TypeScript file: imports compile to require and use index.d.cts.
import xoe, { type Infer, object, string } from "@xopseasy/xoe-validator";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
// oxlint-disable-next-line no-unused-vars -- the type argument is the assertion
const expectType = <T extends true>() => {};

const user = object({
  name: string().minLength(2),
  role: xoe.enum(["admin", "user"]).default("user"),
});
expectType<
  Equal<Infer<typeof user>, { name: string; role: "admin" | "user" }>
>();

// oxfmt-ignore
// @ts-expect-error async validators can't use validate()
xoe.string().refineAsync(() => Promise.resolve(true)).validate("x");
