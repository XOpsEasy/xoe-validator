import { useForm } from "../../lib/useForm.ts";
import { TextField } from "../../ui/fields.tsx";
import { FormSheet } from "../../ui/sheets.tsx";
import { parseQuery } from "./schema.ts";

const initial = {
  query:
    "q=  desk lamp &page=abc&pageSize=500&sort=price&inStock=on&utm_source=mail",
};

export default function SearchFiltersForm() {
  const form = useForm({
    initial,
    validate: (values) => parseQuery(values.query),
  });

  return (
    <FormSheet
      title="Product search"
      form={form}
      submitLabel="Search"
      call="parseQuery(location.search)"
      doneText="Valid. The filters on the yellow sheet are ready to use."
    >
      <TextField
        form={form}
        name="query"
        label="Query string"
        rows={3}
        hint="Edit it by hand, e.g. add &since=2024-02-30 for a date that doesn't exist."
      />
    </FormSheet>
  );
}
