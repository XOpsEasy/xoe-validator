// Inputs for the benchmarks. The valid ones pass in all three libraries, the
// invalid ones fail in all three (bench/validate.bench.ts checks it).

export const validForm = {
  name: "Ana Petrović",
  email: "ana@example.com",
  age: 29,
  role: "user",
  newsletter: true,
  tags: ["frontend", "react"],
  extra: "removed from the output",
};

export const invalidForm = {
  name: "A",
  email: "not an email",
  age: 12.5,
  role: "owner",
  newsletter: "yes",
  tags: ["x", "ok", "y"],
};

const address = { street: "Knez Mihailova 1", city: "Beograd", zip: "11000" };

export const validOrder = {
  id: 1001,
  customer: { name: "Marko Marković", email: "marko@example.com", address },
  items: Array.from({ length: 10 }, (_, i) => ({
    sku: `SKU-${i}`,
    quantity: i + 1,
    price: 9.99 + i,
  })),
  shipping: { method: "courier", address },
};

export const users = Array.from({ length: 1000 }, (_, i) => ({
  id: i + 1,
  name: `User ${i}`,
  email: `user${i}@example.com`,
  active: i % 2 === 0,
}));
