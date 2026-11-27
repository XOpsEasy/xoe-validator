import {
  createState,
  ExtendedValidator,
  extendValidator,
} from "../../core/validator/index.ts";
import { NoRules } from "../../core/types.ts";
import * as en from "../../core/english.ts";

export type InstanceOfValidator<T> = ExtendedValidator<T, NoRules>;

type Constructor = abstract new (...args: never[]) => unknown;

/** Accepts instances of a class, e.g. instanceOf(URL) or instanceOf(Uint8Array). */
export const createInstanceOfValidator = <C extends Constructor>(
  constructor: C,
  message?: string,
): InstanceOfValidator<InstanceType<C>> =>
  extendValidator<InstanceType<C>, NoRules>({})(
    createState(constructor.name, (value) => value instanceof constructor, {
      typeMessage: message ?? en.type(constructor.name),
      customTypeMessage: message !== undefined,
    }),
  );
