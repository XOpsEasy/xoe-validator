// Scenarios against the API, the way a client uses it: npm test.
// The app runs in-process (app.request), so no server or port is needed.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  localizeIssues,
  srMessages,
  toFieldErrors,
  type XOEIssue,
} from "@x-ops-easy/xoe-validator";
import { app } from "./backend/app.ts";
import { stepOf, stepSchema } from "./shared/application.ts";

const send = async (method: string, url: string, body?: unknown) => {
  const response = await app.request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, json: await response.json() };
};
const fieldsOf = (issues: readonly XOEIssue[]) => toFieldErrors(issues);

// The backend keeps registered usernames, so each test signs up a new one.
const validUser = (username: string) => ({
  username,
  email: "Nikola@Example.com",
  password: "secret123",
  confirmPassword: "secret123",
  birthDate: "1990-05-01",
});

test("sign up: the output is trimmed, coerced and has defaults", async () => {
  const { status, json } = await send("POST", "/api/users", validUser("  Nikola_99 "));
  assert.equal(status, 201);
  assert.deepEqual(json.user, {
    username: "nikola_99",
    email: "nikola@example.com",
    birthDate: "1990-05-01T00:00:00.000Z",
    role: "user",
    newsletter: false,
  });
});

test("sign up: issues come back as data, with codes and paths", async () => {
  const { status, json } = await send("POST", "/api/users", {
    username: "a",
    email: "nope",
    password: "short",
    confirmPassword: "other",
    birthDate: "2015-01-01",
    role: "owner",
  });
  assert.equal(status, 400);
  assert.deepEqual(
    json.issues.map((issue: XOEIssue) => `${issue.path.join(".")}:${issue.code}`),
    [
      "username:string.minLength",
      "email:string.email",
      "password:string.minLength",
      "confirmPassword:sameAs",
      "birthDate:date.minAge",
      "role:enum",
    ],
  );
});

test("sign up: the client translates server issues, custom messages stay", async () => {
  const { json } = await send("POST", "/api/users", {
    ...validUser("jelena"),
    password: "short",
    confirmPassword: "other",
  });
  // customMessage: true survives JSON, so "Passwords do not match." is kept.
  assert.deepEqual(fieldsOf(localizeIssues(json.issues, srMessages)), {
    password: ["Tekst mora imati najmanje 8 karaktera."],
    confirmPassword: ["Passwords do not match."],
  });
});

test("sign up: a taken username fails the async check", async () => {
  // "marko" is in the database; the schema lowercases the input first.
  const { status, json } = await send("POST", "/api/users", validUser("Marko"));
  assert.equal(status, 400);
  assert.deepEqual(json.issues.map((issue: XOEIssue) => issue.code), [
    "username.taken",
  ]);
});

test("user list: invalid query parameters fall back (coerce + catch)", async () => {
  const { json } = await send(
    "GET",
    "/api/users?page=abc&pageSize=1000&sort=xyz&q=%20react%20",
  );
  assert.deepEqual(json.query, {
    page: 1,
    pageSize: 20,
    sort: "createdAt",
    q: "react",
  });
});

test("company: Serbian rules for PIB, company number and JMBG", async () => {
  const ok = await send("POST", "/api/companies", {
    name: "Example d.o.o.",
    pib: " 101134702 ",
    companyNumber: "17162543",
  });
  assert.equal(ok.status, 201);

  const bad = await send("POST", "/api/companies", {
    name: "Example d.o.o.",
    pib: "101134703",
    companyNumber: "17162544",
    director: "0101990710009",
  });
  assert.equal(bad.status, 400);
  assert.deepEqual(fieldsOf(localizeIssues(bad.json.issues, srMessages)), {
    pib: ["Neispravan PIB."],
    companyNumber: ["Neispravan matični broj."],
    director: ["Neispravan JMBG."],
  });
});

test("order: nested issues have paths to the item", async () => {
  const { status, json } = await send("POST", "/api/orders", {
    customer: "kupac@example.com",
    items: [
      { sku: "abc-123", quantity: 2, price: 9.99 },
      { sku: "bad", quantity: 0, price: 1.005 },
    ],
  });
  assert.equal(status, 400);
  assert.deepEqual(Object.keys(fieldsOf(json.issues)), [
    "items.1.sku",
    "items.1.quantity",
    "items.1.price",
  ]);

  const valid = await send("POST", "/api/orders", {
    customer: "kupac@example.com",
    items: [{ sku: "abc-123", quantity: 3, price: 9.99 }],
  });
  assert.equal(valid.status, 201);
  assert.equal(valid.json.order.items[0].sku, "ABC-123");
  assert.equal(valid.json.total, 29.97);
});

test("order: a rule across the items (refine on the object)", async () => {
  const { json } = await send("POST", "/api/orders", {
    customer: "kupac@example.com",
    items: [{ sku: "ABC-123", quantity: 101, price: 1 }],
  });
  assert.deepEqual(json.issues.map((issue: XOEIssue) => issue.code), [
    "order.tooMany",
  ]);
});

test("import: 1000 rows, and the issues of a broken row", async () => {
  const rows = Array.from({ length: 1000 }, (_, i) => ({
    email: `user${i}@example.com`,
    name: `User ${i}`,
    age: String(20 + (i % 50)),
  }));
  const ok = await send("POST", "/api/import", rows);
  assert.equal(ok.json.imported, 1000);

  rows[500] = { email: "broken", name: "X", age: "-1" };
  const bad = await send("POST", "/api/import", rows);
  assert.equal(bad.status, 400);
  assert.deepEqual(Object.keys(fieldsOf(bad.json.issues)), [
    "500.email",
    "500.name",
    "500.age",
  ]);
});

test("OpenAPI: the documented schemas are the validated ones", async () => {
  const { json } = await send("GET", "/api/openapi.json");
  const company = json.components.schemas.Company;
  assert.deepEqual(company.required, ["name", "pib", "companyNumber"]);
  assert.equal(company.properties.pib.pattern, "^[0-9]{9}$");
  assert.equal(company.properties.pib.description, "PIB, the tax identification number");
  assert.deepEqual(Object.keys(json.paths), [
    "/api/users",
    "/api/companies",
    "/api/orders",
  ]);
});

const application = {
  personal: {
    firstName: "Ana",
    lastName: "Petrović",
    email: "Ana@Example.com",
    birthDate: "1990-01-01",
  },
  applicant: { type: "person", jmbg: "0101990710008" },
  loans: { hasLoans: false },
  review: { terms: true },
};

test("multi-step form: a step is validated on its own", () => {
  // The values of the other steps aren't checked (and not in the output).
  const result = stepSchema("loans").validate({ loans: { hasLoans: "true" } });
  assert.equal(result.type, "error");
  assert.deepEqual(
    result.type === "error" && result.value.map((issue) => issue.path.join(".")),
    ["loans.loanAmount"],
  );
  assert.deepEqual(stepSchema("applicant").validate(application), {
    type: "success",
    value: { applicant: application.applicant },
  });
});

test("multi-step form: the whole form is sent at the end", async () => {
  const person = await send("POST", "/api/applications", application);
  assert.equal(person.status, 201);
  assert.equal(person.json.application.personal.email, "ana@example.com");

  // The other branch's fields don't reach the server's output.
  const company = await send("POST", "/api/applications", {
    ...application,
    applicant: {
      type: "company",
      companyName: "Example d.o.o.",
      pib: "101134702",
      companyNumber: "17162543",
      jmbg: "left from the person branch",
    },
    loans: { hasLoans: true, loanAmount: "1500.50" },
  });
  assert.equal(company.status, 201);
  assert.deepEqual(company.json.application.applicant, {
    type: "company",
    companyName: "Example d.o.o.",
    pib: "101134702",
    companyNumber: "17162543",
  });
  assert.deepEqual(company.json.application.loans, { hasLoans: true, loanAmount: 1500.5 });
});

test("multi-step form: server issues lead to their steps", async () => {
  const { status, json } = await send("POST", "/api/applications", {
    ...application,
    personal: { ...application.personal, email: "nope" },
    applicant: { type: "company", companyName: "X", pib: "101134703" },
    loans: { hasLoans: true },
    review: { terms: false },
  });
  assert.equal(status, 400);
  assert.deepEqual(
    json.issues.map((issue: XOEIssue) => [issue.path.join("."), stepOf(issue.path)]),
    [
      ["personal.email", 0],
      ["applicant.companyName", 1],
      ["applicant.pib", 1],
      ["applicant.companyNumber", 1],
      ["loans.loanAmount", 2],
      ["review.terms", 3],
    ],
  );
});
