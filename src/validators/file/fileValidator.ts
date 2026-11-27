import {
  defineValidator,
  ExtendedValidator,
} from "../../core/validator/index.ts";
import { ruleRegistry as fileRules } from "./fileRules.ts";

export type FileValidator = ExtendedValidator<File, typeof fileRules>;

const isFile = (value: unknown): value is File =>
  typeof File !== "undefined" && value instanceof File;

/** A file input without a selection is sent as an empty File without a name. */
const emptyFileToUndefined = (value: unknown): unknown =>
  isFile(value) && value.size === 0 && value.name === "" ? undefined : value;

/** A File (form uploads, FormData); an empty file input counts as empty. */
export const createFileValidator = /* @__PURE__ */ defineValidator({
  type: "file",
  check: isFile,
  rules: fileRules,
  preprocess: emptyFileToUndefined,
});
