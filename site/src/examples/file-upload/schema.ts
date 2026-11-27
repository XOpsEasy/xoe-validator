import xoe, { type Infer } from "@x-ops-easy/xoe-validator";

const MB = 1024 * 1024;

export const uploadSchema = xoe.object({
  title: xoe.string().trim().minLength(3),
  // accept() takes MIME types, groups and extensions, like the HTML attribute.
  // A file input without a selection counts as empty, so it reports "required".
  cover: xoe
    .file()
    .accept(["image/*"])
    .maxSize(1 * MB),
  attachments: xoe
    .array(
      xoe
        .file()
        .accept([".pdf", "image/*"])
        .maxSize(2 * MB),
    )
    .maxLength(3)
    .optional(),
});

export type Upload = Infer<typeof uploadSchema>;
// { title: string; cover: File; attachments?: File[] | null }
