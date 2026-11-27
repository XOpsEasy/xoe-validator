import { useForm } from "../../lib/useForm.ts";
import { FormErrors, TextField } from "../../ui/fields.tsx";
import { FormSheet } from "../../ui/sheets.tsx";
import { invoiceSchema, MAX_LINES, totalOf } from "./schema.ts";

const emptyLine = { sku: "", quantity: "1", price: "" };
const initial = {
  customer: "",
  lines: [{ sku: "LMP-001", quantity: "2", price: "24.50" }, emptyLine],
};

export default function InvoiceForm() {
  const form = useForm({
    initial,
    validate: (values) => invoiceSchema.validate(values),
  });
  const { lines } = form.values;
  const setLines = (next: typeof lines) =>
    form.setValues({ ...form.values, lines: next });
  // The total is known only for a valid invoice: it needs parsed numbers.
  const total =
    form.result?.type === "success" ? totalOf(form.result.value.lines) : null;

  return (
    <FormSheet title="New invoice" form={form} submitLabel="Create invoice">
      <TextField
        form={form}
        name="customer"
        label="Customer email"
        type="email"
      />
      {lines.map((_, index) => (
        <div className="field-row line-row" key={index}>
          <TextField
            form={form}
            name={`lines.${index}.sku`}
            label={`Line ${index + 1}: SKU`}
          />
          <TextField
            form={form}
            name={`lines.${index}.quantity`}
            label="Qty"
            inputMode="numeric"
          />
          <TextField
            form={form}
            name={`lines.${index}.price`}
            label="Unit price"
            inputMode="decimal"
          />
          <button
            type="button"
            className="button-plain"
            aria-label={`Remove line ${index + 1}`}
            onClick={() => setLines(lines.filter((_, at) => at !== index))}
          >
            Remove
          </button>
        </div>
      ))}
      {/* Issues of the list itself: nonEmpty, maxLength, uniqueBy, the total. */}
      <FormErrors errors={form.errors("lines")} />
      <div className="form-note">
        <button
          type="button"
          className="button-plain"
          disabled={lines.length > MAX_LINES}
          onClick={() => setLines([...lines, emptyLine])}
        >
          Add a line
        </button>
        <span>
          Total: {total === null ? "fill in the lines" : total.toFixed(2)}
        </span>
      </div>
    </FormSheet>
  );
}
