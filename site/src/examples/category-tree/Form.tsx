import { type FieldApi, useForm } from "../../lib/useForm.ts";
import { FormErrors, TextField } from "../../ui/fields.tsx";
import { FormSheet } from "../../ui/sheets.tsx";
import { type Category, categorySchema } from "./schema.ts";

const initial: Category = {
  name: "Furniture",
  children: [
    { name: "Chairs", children: [{ name: "A", children: [] }] },
    { name: "Chairs", children: [] },
  ],
};

type NodeProps = { form: FieldApi; path: string; depth: number };

/** One category and, below it, its children: the form is recursive too. */
const Node = ({ form, path, depth }: NodeProps) => {
  // Paths look like "children.0.children.1.name", as in the issues.
  const at = (key: string) => (path ? `${path}.${key}` : key);
  const children = (form.get(at("children")) ?? []) as Category[];
  const setChildren = (next: Category[]) => form.set(at("children"), next);

  return (
    <div className="tree-node">
      <TextField
        form={form}
        name={at("name")}
        label={depth === 0 ? "Category" : "Subcategory"}
      />
      <FormErrors errors={form.errors(at("children"))} />
      <div className="tree-children">
        {children.map((_, index) => (
          <div className="tree-child" key={index}>
            <Node
              form={form}
              path={at(`children.${index}`)}
              depth={depth + 1}
            />
            <button
              type="button"
              className="button-plain"
              onClick={() =>
                setChildren(children.filter((_, i) => i !== index))
              }
            >
              Remove
            </button>
          </div>
        ))}
        {depth < 2 && (
          <button
            type="button"
            className="button-plain"
            onClick={() =>
              setChildren([...children, { name: "", children: [] }])
            }
          >
            Add a subcategory
          </button>
        )}
      </div>
    </div>
  );
};

export default function CategoryTreeForm() {
  const form = useForm({
    initial,
    validate: (values) => categorySchema.validate(values),
  });

  return (
    <FormSheet title="Category tree" form={form} submitLabel="Save categories">
      <Node form={form} path="" depth={0} />
    </FormSheet>
  );
}
