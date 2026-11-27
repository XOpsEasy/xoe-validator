import { useForm } from "../../lib/useForm.ts";
import { CheckboxField, Row, TextField } from "../../ui/fields.tsx";
import { FormSheet } from "../../ui/sheets.tsx";
import { bookingSchema } from "./schema.ts";

const initial = {
  checkIn: "",
  checkOut: "",
  guests: "2",
  isCompany: false,
  vatNumber: "",
};

export default function BookingForm() {
  const form = useForm({
    initial,
    validate: (values) => bookingSchema.validate(values),
  });

  return (
    <FormSheet title="Book a room" form={form} submitLabel="Book the room">
      <Row>
        <TextField form={form} name="checkIn" label="Check-in" type="date" />
        <TextField form={form} name="checkOut" label="Check-out" type="date" />
      </Row>
      <TextField form={form} name="guests" label="Guests" inputMode="numeric" />
      <CheckboxField form={form} name="isCompany" label="Invoice a company" />
      {form.values.isCompany && (
        <TextField form={form} name="vatNumber" label="VAT number" />
      )}
    </FormSheet>
  );
}
