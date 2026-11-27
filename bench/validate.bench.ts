// Compares xoe with Zod and Valibot: npm run bench
//
// xoe is the built package (dist), like the other two: Vitest adds overhead to
// calls between source modules, which would count against xoe only.
//
// Read the results as ratios ("1.5x slower"), not absolute times: they depend
// on the machine. Run a few times with heavy apps closed.
import { expect, test } from "vitest";
import * as v from "valibot";
import {
  valibotForm,
  valibotOrder,
  valibotUsers,
  xoeForm,
  xoeOrder,
  xoeUsers,
  zodForm,
  zodOrder,
  zodUsers,
} from "./schemas.ts";
import { invalidForm, users, validForm, validOrder } from "./data.ts";

const form = { xoe: xoeForm(), zod: zodForm(), valibot: valibotForm() };
const order = { xoe: xoeOrder(), zod: zodOrder(), valibot: valibotOrder() };
const list = { xoe: xoeUsers(), zod: zodUsers(), valibot: valibotUsers() };

// The libraries must agree, or the comparison isn't fair: same result for
// every input, and the same output for valid ones.
const check = (
  name: string,
  schemas: { xoe: typeof form.xoe | typeof order.xoe | typeof list.xoe },
  zodSchema: {
    safeParse(value: unknown): { success: boolean; data?: unknown };
  },
  valibotSchema: v.GenericSchema,
  input: unknown,
  valid: boolean,
) => {
  const ours = schemas.xoe.validate(input);
  const zod = zodSchema.safeParse(input);
  const valibot = v.safeParse(valibotSchema, input);
  expect(
    [ours.type === "success", zod.success, valibot.success],
    `${name}: the libraries disagree`,
  ).toStrictEqual([valid, valid, valid]);
  if (valid) {
    expect(ours.value, `${name}: xoe and Zod outputs differ`).toStrictEqual(
      zod.data,
    );
    expect(ours.value, `${name}: Valibot output differs`).toStrictEqual(
      valibot.output,
    );
  }
};
check("form", form, form.zod, form.valibot, validForm, true);
check("form", form, form.zod, form.valibot, invalidForm, false);
check("order", order, order.zod, order.valibot, validOrder, true);
check("users", list, list.zod, list.valibot, users, true);

// All three report every issue of the invalid form. Zod checks int() as part
// of the type, so it skips min(18) after it: 7 issues instead of 8.
const ours = form.xoe.validate(invalidForm);
expect(ours.type === "error" ? ours.value.length : 0).toBe(8);
expect(form.zod.safeParse(invalidForm).error?.issues.length).toBe(7);
expect(v.safeParse(form.valibot, invalidForm).issues?.length).toBe(8);

// Local copies: reading an import inside a benchmark goes through a getter of
// Vitest's module runner.
const inputs = { validForm, invalidForm, validOrder, users };
const create = { xoeForm, zodForm, valibotForm };

test("form, valid", async ({ bench }) => {
  await bench.compare(
    bench("xoe", () => {
      form.xoe.validate(inputs.validForm);
    }),
    bench("zod", () => {
      form.zod.safeParse(inputs.validForm);
    }),
    bench("valibot", () => {
      v.safeParse(form.valibot, inputs.validForm);
    }),
  );
});

test("form, with issues", async ({ bench }) => {
  await bench.compare(
    bench("xoe", () => {
      form.xoe.validate(inputs.invalidForm);
    }),
    bench("zod", () => {
      form.zod.safeParse(inputs.invalidForm);
    }),
    bench("valibot", () => {
      v.safeParse(form.valibot, inputs.invalidForm);
    }),
  );
});

test("nested order", async ({ bench }) => {
  await bench.compare(
    bench("xoe", () => {
      order.xoe.validate(inputs.validOrder);
    }),
    bench("zod", () => {
      order.zod.safeParse(inputs.validOrder);
    }),
    bench("valibot", () => {
      v.safeParse(order.valibot, inputs.validOrder);
    }),
  );
});

test("1000 users", async ({ bench }) => {
  await bench.compare(
    bench("xoe", () => {
      list.xoe.validate(inputs.users);
    }),
    bench("zod", () => {
      list.zod.safeParse(inputs.users);
    }),
    bench("valibot", () => {
      v.safeParse(list.valibot, inputs.users);
    }),
  );
});

test("create the form schema", async ({ bench }) => {
  await bench.compare(
    bench("xoe", () => {
      create.xoeForm();
    }),
    bench("zod", () => {
      create.zodForm();
    }),
    bench("valibot", () => {
      create.valibotForm();
    }),
  );
});
