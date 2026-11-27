import xoe, { type Infer } from "@x-ops-easy/xoe-validator";

const line = xoe.object({
  sku: xoe
    .string()
    .trim()
    .toUpperCase()
    .regexMatch(/^[A-Z]{3}-\d{3}$/, "Use the format ABC-123."),
  quantity: xoe.coerce.number().integer().between(1, 99),
  price: xoe.coerce.number().positive().maxDecimals(2),
});

export const totalOf = (
  lines: readonly { quantity: number; price: number }[],
) => lines.reduce((sum, item) => sum + item.quantity * item.price, 0);

export const MAX_LINES = 5;

export const invoiceSchema = xoe
  .object({
    customer: xoe.string().trim().toLowerCase().email(),
    // An issue of an item has the item's path: ["lines", 1, "price"].
    lines: xoe
      .array(line)
      .nonEmpty("Add at least one line.")
      .maxLength(MAX_LINES)
      // Compared after toUpperCase(), so "abc-123" and "ABC-123" are the same.
      .uniqueBy("sku", "Each SKU can appear only once."),
  })
  .refine((invoice) => totalOf(invoice.lines) <= 10_000, {
    code: "invoice.total",
    message: "The total can be at most 10,000.00.",
    path: ["lines"],
  });

export type Invoice = Infer<typeof invoiceSchema>;
