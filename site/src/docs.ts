import type { DocPage } from "./lib/content.ts";

const pages = import.meta.glob<DocPage>(
  ["../../docs/*.md", "../../README.md"],
  { query: "?doc", import: "default" },
);

type DocLink = { slug: string; title: string };

/** The order of docs/README.md. */
export const docGroups: { title: string; pages: DocLink[] }[] = [
  {
    title: "Start",
    pages: [
      { slug: "getting-started", title: "Getting started" },
      { slug: "migrating-from-zod", title: "Migrating from Zod" },
    ],
  },
  {
    title: "Validating values",
    pages: [
      { slug: "validators", title: "Validators and rules" },
      { slug: "single-values", title: "Validating single values" },
      { slug: "objects", title: "Objects" },
      { slug: "unions-and-records", title: "Unions, records and recursion" },
      { slug: "methods", title: "Common methods" },
      { slug: "input-and-output", title: "Input and output" },
      { slug: "composing", title: "Composing validators" },
      { slug: "async", title: "Async validation" },
      { slug: "multi-step-forms", title: "Multi-step forms" },
    ],
  },
  {
    title: "Errors and results",
    pages: [
      { slug: "errors", title: "Issues and errors" },
      { slug: "results", title: "Working with results" },
      { slug: "translations", title: "Translations" },
    ],
  },
  {
    title: "Extending and integrating",
    pages: [
      { slug: "country-rules", title: "Country rules" },
      { slug: "custom-rules", title: "Custom rules and types" },
      { slug: "json-schema", title: "Validating with JSON Schema" },
      { slug: "to-json-schema", title: "From xoe to JSON Schema" },
      { slug: "standard-schema", title: "Standard Schema" },
    ],
  },
];

export const docTitle = (slug: string) =>
  docGroups.flatMap((group) => group.pages).find((page) => page.slug === slug)
    ?.title;

const fileOf = (slug: string) =>
  slug === "getting-started" ? "../../README.md" : `../../docs/${slug}.md`;

const cache = new Map<string, Promise<DocPage>>();

/** The page of a slug ("async"), or undefined when there is none. */
export const loadDoc = (slug: string): Promise<DocPage> | undefined => {
  const load = pages[fileOf(slug)];
  if (!load) return undefined;
  const cached = cache.get(slug) ?? load();
  cache.set(slug, cached);
  return cached;
};
