import { useForm } from "../../lib/useForm.ts";
import { FormErrors, Row, TextField } from "../../ui/fields.tsx";
import { FormSheet } from "../../ui/sheets.tsx";
import { currencySchema, productSchema } from "./schema.ts";

const initial = {
  name: "",
  prices: { eur: "", usd: "", rsd: "" },
  size: ["", "", ""],
};

/** A currency without a price isn't for sale: leave it out of the record. */
const withoutEmpty = (prices: Record<string, string>) =>
  Object.fromEntries(
    Object.entries(prices).filter(([, price]) => price.trim() !== ""),
  );

export default function PriceListForm() {
  const form = useForm({
    initial,
    validate: (values) =>
      productSchema.validate({
        ...values,
        prices: withoutEmpty(values.prices),
      }),
  });

  return (
    <FormSheet title="Add a product" form={form} submitLabel="Add product">
      <TextField form={form} name="name" label="Name" />
      <Row>
        {currencySchema.options.map((currency) => (
          <TextField
            key={currency}
            form={form}
            name={`prices.${currency}`}
            label={`Price in ${currency.toUpperCase()}`}
            inputMode="decimal"
            optional
          />
        ))}
      </Row>
      <FormErrors errors={form.errors("prices")} />
      <Row>
        {["Width", "Height", "Depth"].map((label, index) => (
          <TextField
            key={label}
            form={form}
            name={`size.${index}`}
            label={`${label} (mm)`}
            inputMode="numeric"
          />
        ))}
      </Row>
    </FormSheet>
  );
}
