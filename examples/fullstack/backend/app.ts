// The API. Every route validates with a schema from shared/schemas.ts and
// answers 400 with the issues as data: the client maps them to fields and
// translates them (localizeIssues), also in a language the server doesn't know.
import { Hono } from "hono";
import { toJsonSchema, type XOEIssue } from "@x-ops-easy/xoe-validator";
import {
  companySchema,
  importSchema,
  orderSchema,
  signUpSchema,
  userListQuery,
} from "../shared/schemas.ts";
import { applicationSchema } from "../shared/application.ts";
import { db } from "./db.ts";

const invalid = (issues: readonly XOEIssue[]) => ({ issues });

// The backend checks usernames in its database (the frontend asks the API).
const signUp = signUpSchema((username) =>
  Promise.resolve(!db.usernames.has(username))
);

export const app = new Hono();

app.post("/api/users", async (c) => {
  // validateAsync: the username check is async. The request's signal cancels
  // the check when the client goes away.
  const result = await signUp.validateAsync(await c.req.json(), {
    signal: c.req.raw.signal,
  });
  if (result.type === "error") return c.json(invalid(result.value), 400);

  const { confirmPassword: _, password: __, ...user } = result.value;
  db.usernames.add(user.username);
  return c.json({ user }, 201);
});

app.get("/api/users/available/:username", (c) =>
  c.json({ available: !db.usernames.has(c.req.param("username").toLowerCase()) })
);

app.get("/api/users", (c) => {
  // Always a success: catch() replaces invalid query parameters.
  const query = userListQuery.validate(c.req.query());
  return c.json({ query: query.type === "success" ? query.value : null });
});

app.post("/api/companies", async (c) => {
  const result = companySchema.validate(await c.req.json());
  if (result.type === "error") return c.json(invalid(result.value), 400);
  return c.json({ company: result.value }, 201);
});

app.post("/api/orders", async (c) => {
  const result = orderSchema.validate(await c.req.json());
  if (result.type === "error") return c.json(invalid(result.value), 400);
  const total = result.value.items.reduce(
    (sum, item) => sum + item.quantity * item.price,
    0,
  );
  return c.json({ order: result.value, total: Math.round(total * 100) / 100 }, 201);
});

// The multi-step form is sent once, at the end: the server validates the
// whole form, including the rules across steps.
app.post("/api/applications", async (c) => {
  const result = applicationSchema.validate(await c.req.json());
  if (result.type === "error") return c.json(invalid(result.value), 400);
  return c.json({ application: result.value }, 201);
});

app.post("/api/import", async (c) => {
  const started = performance.now();
  const result = importSchema.validate(await c.req.json());
  const ms = Math.round((performance.now() - started) * 100) / 100;
  if (result.type === "error") {
    // Report the first rows only: a broken file can have thousands of issues.
    return c.json({ ...invalid(result.value.slice(0, 20)), total: result.value.length, ms }, 400);
  }
  return c.json({ imported: result.value.length, ms });
});

// The schemas you validate with are the ones you document.
app.get("/api/openapi.json", (c) => {
  const schema = (validator: Parameters<typeof toJsonSchema>[0]) => {
    const { $schema: _, ...rest } = toJsonSchema(validator, {
      unrepresentable: "any",
    });
    return rest;
  };
  const body = (name: string) => ({
    required: true,
    content: {
      "application/json": { schema: { $ref: `#/components/schemas/${name}` } },
    },
  });
  return c.json({
    openapi: "3.1.0",
    info: { title: "xoe fullstack example", version: "1.0.0" },
    paths: {
      "/api/users": { post: { requestBody: body("SignUp"), responses: { 201: { description: "Created" }, 400: { description: "Issues" } } } },
      "/api/companies": { post: { requestBody: body("Company"), responses: { 201: { description: "Created" }, 400: { description: "Issues" } } } },
      "/api/orders": { post: { requestBody: body("Order"), responses: { 201: { description: "Created" }, 400: { description: "Issues" } } } },
    },
    components: {
      schemas: {
        SignUp: schema(signUp),
        Company: schema(companySchema),
        Order: schema(orderSchema),
      },
    },
  });
});
