/** A source file as highlighted HTML (plugins/content.ts, `?code`). */
export type SourceFile = { name: string; html: string };

/** A Markdown page as HTML (plugins/content.ts, `?doc`). */
export type DocPage = {
  title: string;
  html: string;
  headings: { id: string; text: string }[];
};
