import { useForm } from "../../lib/useForm.ts";
import { RadioField, Row, TextField } from "../../ui/fields.tsx";
import { FormSheet } from "../../ui/sheets.tsx";
import { paymentSchema } from "./schema.ts";

// The form keeps the fields of every method, so switching back and forth
// doesn't lose what was typed. The schema sends only the selected one.
const initial = {
  amount: "49.90",
  payment: {
    method: "card",
    cardNumber: "",
    expiry: "",
    cvc: "",
    iban: "",
    accountHolder: "",
    paypalEmail: "",
  },
};

const methods = [
  { value: "card", label: "Card" },
  { value: "transfer", label: "Bank transfer" },
  { value: "paypal", label: "PayPal" },
];

export default function PaymentForm() {
  const form = useForm({
    initial,
    validate: (values) => paymentSchema.validate(values),
  });
  const { method } = form.values.payment;

  return (
    <FormSheet title="Pay" form={form} submitLabel="Pay now">
      <TextField
        form={form}
        name="amount"
        label="Amount (EUR)"
        inputMode="decimal"
      />
      <RadioField
        form={form}
        name="payment.method"
        label="Pay with"
        options={methods}
      />
      {method === "card" && (
        <>
          <TextField
            form={form}
            name="payment.cardNumber"
            label="Card number"
            inputMode="numeric"
            hint="Try 4242 4242 4242 4242."
          />
          <Row>
            <TextField
              form={form}
              name="payment.expiry"
              label="Expires"
              placeholder="MM/YY"
            />
            <TextField
              form={form}
              name="payment.cvc"
              label="CVC"
              inputMode="numeric"
            />
          </Row>
        </>
      )}
      {method === "transfer" && (
        <>
          <TextField
            form={form}
            name="payment.iban"
            label="IBAN"
            hint="Try RS35 2600 0560 1001 6113 79."
          />
          <TextField
            form={form}
            name="payment.accountHolder"
            label="Account holder"
          />
        </>
      )}
      {method === "paypal" && (
        <TextField
          form={form}
          name="payment.paypalEmail"
          label="PayPal email"
          type="email"
        />
      )}
    </FormSheet>
  );
}
