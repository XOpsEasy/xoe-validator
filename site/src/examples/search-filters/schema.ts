import xoe from "@x-ops-easy/xoe-validator";

// A query string holds only strings, and users edit it by hand. coerce
// converts the strings; catch() replaces a wrong value with a fallback, so a
// bad link still shows a page.
export const filtersSchema = xoe.object({
  q: xoe.string().trim().maxLength(50).optional(),
  page: xoe.coerce.number().integer().minimum(1).catch(1),
  pageSize: xoe.coerce.number().integer().between(1, 100).catch(20),
  sort: xoe.enum(["newest", "price", "name"]).catch("newest"),
  // "true", "1", "on" and "yes" are true.
  inStock: xoe.coerce.boolean().default(false),
  // No catch(): a wrong date is reported. coerce.date() also rejects dates
  // that don't exist, such as 2024-02-30.
  since: xoe.coerce.date().optional(),
});

export const parseQuery = (query: string) =>
  // Keys that are not in the schema (utm_source, ...) are removed.
  filtersSchema.validate(Object.fromEntries(new URLSearchParams(query)));
