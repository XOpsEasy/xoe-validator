// The same schemas in xoe, Zod and Valibot. All three remove unknown keys
// from objects and collect every issue (they don't stop at the first one),
// so they do the same work.
import xoe from "@x-ops-easy/xoe-validator";
import { z } from "zod";
import * as v from "valibot";

// ---------- a sign-up form --------------------------------------------------

export const xoeForm = () =>
  xoe.object({
    name: xoe.string().minLength(2).maxLength(50),
    email: xoe.string().email(),
    age: xoe.number().integer().minimum(18),
    role: xoe.enum(["admin", "user", "guest"]),
    newsletter: xoe.boolean(),
    tags: xoe.array(xoe.string().minLength(2)).maxLength(5),
  });

export const zodForm = () =>
  z.object({
    name: z.string().min(2).max(50),
    email: z.string().email(),
    age: z.number().int().min(18),
    role: z.enum(["admin", "user", "guest"]),
    newsletter: z.boolean(),
    tags: z.array(z.string().min(2)).max(5),
  });

export const valibotForm = () =>
  v.object({
    name: v.pipe(v.string(), v.minLength(2), v.maxLength(50)),
    email: v.pipe(v.string(), v.email()),
    age: v.pipe(v.number(), v.integer(), v.minValue(18)),
    role: v.picklist(["admin", "user", "guest"]),
    newsletter: v.boolean(),
    tags: v.pipe(v.array(v.pipe(v.string(), v.minLength(2))), v.maxLength(5)),
  });

// ---------- an order with nested objects and a list -------------------------

export const xoeOrder = () => {
  const address = xoe.object({
    street: xoe.string().minLength(1),
    city: xoe.string().minLength(1),
    zip: xoe.string().length(5),
  });
  return xoe.object({
    id: xoe.number().integer().positive(),
    customer: xoe.object({
      name: xoe.string().minLength(2),
      email: xoe.string().email(),
      address,
    }),
    items: xoe
      .array(
        xoe.object({
          sku: xoe.string().minLength(3),
          quantity: xoe.number().integer().positive(),
          price: xoe.number().positive(),
        }),
      )
      .minLength(1),
    shipping: xoe.object({ method: xoe.enum(["post", "courier"]), address }),
  });
};

export const zodOrder = () => {
  const address = z.object({
    street: z.string().min(1),
    city: z.string().min(1),
    zip: z.string().length(5),
  });
  return z.object({
    id: z.number().int().positive(),
    customer: z.object({
      name: z.string().min(2),
      email: z.string().email(),
      address,
    }),
    items: z
      .array(
        z.object({
          sku: z.string().min(3),
          quantity: z.number().int().positive(),
          price: z.number().positive(),
        }),
      )
      .min(1),
    shipping: z.object({ method: z.enum(["post", "courier"]), address }),
  });
};

export const valibotOrder = () => {
  const address = v.object({
    street: v.pipe(v.string(), v.minLength(1)),
    city: v.pipe(v.string(), v.minLength(1)),
    zip: v.pipe(v.string(), v.length(5)),
  });
  return v.object({
    id: v.pipe(v.number(), v.integer(), v.minValue(1)),
    customer: v.object({
      name: v.pipe(v.string(), v.minLength(2)),
      email: v.pipe(v.string(), v.email()),
      address,
    }),
    items: v.pipe(
      v.array(
        v.object({
          sku: v.pipe(v.string(), v.minLength(3)),
          quantity: v.pipe(v.number(), v.integer(), v.minValue(1)),
          price: v.pipe(v.number(), v.gtValue(0)),
        }),
      ),
      v.minLength(1),
    ),
    shipping: v.object({ method: v.picklist(["post", "courier"]), address }),
  });
};

// ---------- a list of users (an API payload) --------------------------------

export const xoeUsers = () =>
  xoe.array(
    xoe.object({
      id: xoe.number().integer().positive(),
      name: xoe.string().minLength(2),
      email: xoe.string().email(),
      active: xoe.boolean(),
    }),
  );

export const zodUsers = () =>
  z.array(
    z.object({
      id: z.number().int().positive(),
      name: z.string().min(2),
      email: z.string().email(),
      active: z.boolean(),
    }),
  );

export const valibotUsers = () =>
  v.array(
    v.object({
      id: v.pipe(v.number(), v.integer(), v.minValue(1)),
      name: v.pipe(v.string(), v.minLength(2)),
      email: v.pipe(v.string(), v.email()),
      active: v.boolean(),
    }),
  );
