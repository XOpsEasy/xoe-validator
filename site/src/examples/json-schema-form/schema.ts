import xoe, { type Infer } from "@x-ops-easy/xoe-validator";

// A JSON Schema, e.g. from an OpenAPI document or a CMS. Written "as const",
// the output type is inferred from it.
export const ticketJsonSchema = {
  type: "object",
  required: ["title", "priority", "estimate"],
  properties: {
    title: { type: "string", title: "Title", minLength: 5, maxLength: 60 },
    priority: { enum: ["low", "normal", "high"], title: "Priority" },
    estimate: {
      type: "integer",
      title: "Estimate (hours)",
      minimum: 1,
      maximum: 40,
    },
    reporter: { type: "string", title: "Reporter's email", format: "email" },
    version: {
      type: "string",
      title: "Version",
      pattern: "^\\d+\\.\\d+\\.\\d+$",
    },
  },
  additionalProperties: false,
} as const;

// An xoe validator like any other: the same issues, codes and paths.
export const ticketSchema = xoe.jsonSchema(ticketJsonSchema);

export type Ticket = Infer<typeof ticketSchema>;
// { title: string; priority: "low" | "normal" | "high"; estimate: number; reporter?: string; version?: string }
