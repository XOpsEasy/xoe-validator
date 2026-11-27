import { expect, test } from "vitest";
import xoe, {
  Infer,
  toFieldErrors,
  XOEValidationOutput,
} from "../../../index.ts";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;

const fieldErrors = <T>(result: XOEValidationOutput<T>) =>
  result.type === "error" ? toFieldErrors(result.value) : {};

const file = (name: string, type: string, size: number) =>
  new File([new Uint8Array(size)], name, { type });

test("file - accepts files", () => {
  const avatar = xoe.file();
  const png = file("a.png", "image/png", 10);

  expect(avatar.validate(png)).toStrictEqual({ type: "success", value: png });
  expect(fieldErrors(avatar.validate("a.png"))).toStrictEqual({
    "": ["Value must be a file."],
  });

  const isEqual: Equal<Infer<typeof avatar>, File> = true;
  expect(isEqual).toStrictEqual(true);
});

test("file - an empty file input counts as empty", () => {
  const empty = new File([], "");

  expect(fieldErrors(xoe.file().validate(empty))).toStrictEqual({
    "": ["This field is required."],
  });
  expect(xoe.file().optional().validate(empty)).toStrictEqual({
    type: "success",
    value: undefined,
  });
  // A named file with no content is still a file.
  expect(xoe.file().validate(new File([], "empty.txt")).type).toStrictEqual(
    "success",
  );
});

test("file - maxSize and minSize", () => {
  const upload = xoe
    .file()
    .minSize(10)
    .maxSize(2 * 1024 * 1024);

  expect(upload.validate(file("a.txt", "text/plain", 100)).type).toStrictEqual(
    "success",
  );
  expect(
    fieldErrors(upload.validate(file("a.txt", "text/plain", 5))),
  ).toStrictEqual({
    "": ["File must be at least 10 B."],
  });
  expect(upload.validate(file("big.bin", "", 3 * 1024 * 1024))).toStrictEqual({
    type: "error",
    value: [
      {
        code: "file.maxSize",
        message: "File must be at most 2 MB.",
        params: { max: 2 * 1024 * 1024 },
        path: [],
      },
    ],
  });
});

test("file - accept MIME types, groups and extensions", () => {
  const document = xoe.file().accept(["image/*", "application/pdf", ".docx"]);

  for (const ok of [
    file("a.png", "image/png", 1),
    file("a.JPG", "IMAGE/JPEG", 1),
    file("cv.pdf", "application/pdf", 1),
    file("cv.DOCX", "", 1),
  ]) {
    expect(document.validate(ok).type, ok.name).toStrictEqual("success");
  }
  expect(
    fieldErrors(
      document.validate(file("a.exe", "application/x-msdownload", 1)),
    ),
  ).toStrictEqual({
    "": ["File type must be one of: image/*, application/pdf, .docx."],
  });
});

test("file - inside a form", () => {
  const form = xoe.object({
    name: xoe.string(),
    avatar: xoe.file().accept(["image/*"]).maxSize(1024).optional(),
    attachments: xoe.array(xoe.file().maxSize(1024)).maxLength(3),
  });

  const result = form.validate({
    name: "Jo",
    avatar: new File([], ""),
    attachments: [file("a.txt", "text/plain", 2048)],
  });
  expect(fieldErrors(result)).toStrictEqual({
    "attachments.0": ["File must be at most 1 KB."],
  });
});
