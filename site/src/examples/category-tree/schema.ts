import xoe, { type Validator } from "@xopseasy/xoe-validator";

// A recursive type needs an explicit annotation; lazy() refers to the schema
// while it is being defined.
export type Category = { name: string; children: Category[] };

export const categorySchema: Validator<Category> = xoe.object({
  name: xoe.string().trim().minLength(2),
  children: xoe
    .array(xoe.lazy(() => categorySchema))
    .maxLength(3)
    .uniqueBy("name", "Sibling categories need different names."),
});
