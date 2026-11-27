import { useForm } from "../../lib/useForm.ts";
import { SelectField, TextField } from "../../ui/fields.tsx";
import { FormSheet } from "../../ui/sheets.tsx";
import { ticketJsonSchema, ticketSchema } from "./schema.ts";

const { properties, required } = ticketJsonSchema;
type Name = keyof typeof properties;
const names = Object.keys(properties) as Name[];
const isRequired = (name: Name) =>
  (required as readonly string[]).includes(name);

const initial = Object.fromEntries(names.map((name) => [name, ""])) as Record<
  Name,
  string
>;

// JSON Schema semantics apply: "" and null are values, only a missing key is
// missing, and nothing is coerced. So the form leaves out empty inputs and
// converts the numbers itself.
const toJson = (values: Record<Name, string>) =>
  Object.fromEntries(
    names
      .filter((name) => values[name].trim() !== "")
      .map((name) => {
        const numeric =
          "type" in properties[name] && properties[name].type === "integer";
        return [name, numeric ? Number(values[name]) : values[name]];
      }),
  );

export default function JsonSchemaForm() {
  const form = useForm({
    initial,
    validate: (values) => ticketSchema.validate(toJson(values)),
  });

  return (
    <FormSheet
      title="New ticket"
      form={form}
      submitLabel="Create ticket"
      call="xoe.jsonSchema(schema).validate(values)"
    >
      {/* The fields are drawn from the schema, not written by hand. */}
      {names.map((name) => {
        const property = properties[name];
        const shared = {
          form,
          name,
          label: property.title,
          optional: !isRequired(name),
        };
        return "enum" in property ? (
          <SelectField
            key={name}
            {...shared}
            options={property.enum}
            empty="Choose"
          />
        ) : (
          <TextField
            key={name}
            {...shared}
            inputMode={property.type === "integer" ? "numeric" : undefined}
          />
        );
      })}
    </FormSheet>
  );
}
