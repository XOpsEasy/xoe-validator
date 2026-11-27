import xoe, { type Infer } from "@xopseasy/xoe-validator";

export const currencySchema = xoe.enum(["eur", "usd", "rsd"]);

const millimetres = xoe.coerce.number().integer().positive();

export const productSchema = xoe
  .object({
    name: xoe.string().trim().minLength(2),
    // A record validates its keys and its values. With an enum as the key,
    // the output is Partial<Record<"eur" | "usd" | "rsd", number>>.
    prices: xoe.record(
      currencySchema,
      xoe.coerce.number().positive().maxDecimals(2),
    ),
    // A tuple validates every position: [width, height, depth].
    size: xoe.tuple([millimetres, millimetres, millimetres]),
  })
  .refine((product) => Object.keys(product.prices).length > 0, {
    code: "product.price",
    message: "Enter a price in at least one currency.",
    path: ["prices"],
  });

export type Product = Infer<typeof productSchema>;
