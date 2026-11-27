import { expect, test } from "vitest";
import xoe, {
  Infer,
  toFieldErrors,
  Validator,
  XOEValidationOutput,
} from "../../../index.ts";
import { expectedSuccess } from "../../../core/tests/helpers.ts";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;

const fieldErrors = <T>(result: XOEValidationOutput<T>) =>
  result.type === "error" ? toFieldErrors(result.value) : {};

const user = xoe.object({
  id: xoe.number().integer().positive(),
  email: xoe.string().email(),
  name: xoe.string().minLength(2),
  role: xoe.enum(["admin", "user"]).default("user"),
});

test("composition - pick", () => {
  const login = user.pick("email");

  expect(Object.keys(login.shape)).toStrictEqual(["email"]);
  expect(login.validate({ email: "a@b.io", id: 1 })).toStrictEqual(
    expectedSuccess({ email: "a@b.io" }),
  );
  expect(fieldErrors(login.validate({}))).toStrictEqual({
    email: ["This field is required."],
  });

  const isEqual: Equal<Infer<typeof login>, { email: string }> = true;
  expect(isEqual).toStrictEqual(true);
});

test("composition - omit", () => {
  const withoutId = user.omit("id", "role");

  expect(Object.keys(withoutId.shape)).toStrictEqual(["email", "name"]);
  expect(
    withoutId.validate({ id: 1, email: "a@b.io", name: "Jo" }),
  ).toStrictEqual(expectedSuccess({ email: "a@b.io", name: "Jo" }));

  const isEqual: Equal<
    Infer<typeof withoutId>,
    { email: string; name: string }
  > = true;
  expect(isEqual).toStrictEqual(true);
});

test("composition - partial makes fields optional but still validated", () => {
  const patch = user.partial();

  expect(patch.validate({})).toStrictEqual(
    expectedSuccess({ role: "user" as const }),
  );
  expect(fieldErrors(patch.validate({ email: "nope" }))).toStrictEqual({
    email: ["Invalid email address."],
  });

  const isEqual: Equal<
    Infer<typeof patch>,
    {
      id?: number | null | undefined;
      email?: string | null | undefined;
      name?: string | null | undefined;
      role?: "admin" | "user" | null | undefined;
    }
  > = true;
  expect(isEqual).toStrictEqual(true);
});

test("composition - partial with keys", () => {
  const draft = user.partial("name", "role");

  expect(fieldErrors(draft.validate({}))).toStrictEqual({
    id: ["This field is required."],
    email: ["This field is required."],
  });

  const isEqual: Equal<
    Infer<typeof draft>,
    {
      id: number;
      email: string;
      name?: string | null | undefined;
      role?: "admin" | "user" | null | undefined;
    }
  > = true;
  expect(isEqual).toStrictEqual(true);
});

test("composition - extend adds and replaces fields", () => {
  const admin = user.extend({
    role: xoe.literal("admin"),
    permissions: xoe.array(xoe.string()).nonEmpty(),
  });

  expect(Object.keys(admin.shape)).toStrictEqual([
    "id",
    "email",
    "name",
    "role",
    "permissions",
  ]);
  expect(
    fieldErrors(
      admin.validate({
        id: 1,
        email: "a@b.io",
        name: "Jo",
        role: "user",
        permissions: [],
      }),
    ),
  ).toStrictEqual({
    role: ['Value must be "admin".'],
    permissions: ["Must have at least 1 item."],
  });

  const isEqual: Equal<
    Infer<typeof admin>,
    {
      id: number;
      email: string;
      name: string;
      role: "admin";
      permissions: string[];
    }
  > = true;
  expect(isEqual).toStrictEqual(true);
});

test("composition - create and update DTOs from one schema", () => {
  const createUser = user.omit("id");
  const updateUser = createUser.partial().strict();

  expect(
    createUser.validate({ email: "a@b.io", name: "Jo" }).type,
  ).toStrictEqual("success");
  expect(updateUser.validate({ name: "Ana" }).type).toStrictEqual("success");
  expect(fieldErrors(updateUser.validate({ id: 5 }))).toStrictEqual({
    "": ["Unknown fields are not allowed. Allowed fields: email, name, role."],
  });
});

test("composition - object settings are not copied", () => {
  const strictRange = xoe
    .object({ from: xoe.number(), to: xoe.number() })
    .strict()
    .refine((value) => value.from < value.to, "from must be lower");

  const picked = strictRange.pick("from");
  expect(picked.validate({ from: 5, extra: true })).toStrictEqual(
    expectedSuccess({ from: 5 }),
  );
  expect(strictRange.omit("to").validate({ from: 9 }).type).toStrictEqual(
    "success",
  );
});

test("composition - members survive chain methods", () => {
  const chained = user.strict().optional().abortEarly();

  expect(Object.keys(chained.shape)).toStrictEqual([
    "id",
    "email",
    "name",
    "role",
  ]);
  expect(Object.keys(chained.pick("name").shape)).toStrictEqual(["name"]);
});

test("composition - the shape is a frozen copy", () => {
  const fields = { name: xoe.string() } as Record<string, Validator<unknown>>;
  const schema = xoe.object(fields);
  fields.extra = xoe.number();

  expect(Object.keys(schema.shape)).toStrictEqual(["name"]);
  expect(Object.isFrozen(schema.shape)).toStrictEqual(true);
  expect(() => {
    (schema.shape as Record<string, unknown>).name = xoe.number();
  }).toThrow();
});

test("composition - partial works for lazy and jsonSchema fields", () => {
  type Node = { name: string; children: Node[] };
  const node: Validator<Node> = xoe.object({
    name: xoe.string(),
    children: xoe.array(xoe.lazy(() => node)),
  });
  const schema = xoe
    .object({
      tree: xoe.lazy(() => node),
      meta: xoe.jsonSchema({ type: "object" }),
    })
    .partial();

  expect(schema.validate({}).type).toStrictEqual("success");
  expect(
    fieldErrors(schema.validate({ tree: { name: 1, children: [] } })),
  ).toStrictEqual({
    "tree.name": ["Value must be text."],
  });
  expect(fieldErrors(schema.validate({ meta: "x" }))).toStrictEqual({
    meta: ["Value must be an object."],
  });
});
