// Turns source files and Markdown into highlighted HTML at build time, so the
// site ships no highlighter and no Markdown parser:
//
//   import source from "./schema.ts?code";   // { name, html }
//   import page from "../../docs/async.md?doc"; // { title, html, headings }
import { readFile } from "node:fs/promises";
import { basename, dirname, extname, relative, resolve } from "node:path";
import { Marked, type Tokens } from "marked";
import { createCssVariablesTheme, createHighlighter } from "shiki";
import type { Plugin } from "vite";

const CODE = "\0xoe-code:";
const DOC = "\0xoe-doc:";
const REPOSITORY = "https://github.com/XOpsEasy/xoe-validator";
const SITE = "https://validator.xopseasy.org/";

const languages = ["ts", "tsx", "json", "sh", "html"] as const;
type Language = (typeof languages)[number];

// Token colors come from CSS variables (--shiki-*), set in styles.css.
const theme = createCssVariablesTheme({ name: "sheet", fontStyle: true });

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const isLanguage = (value: string): value is Language =>
  (languages as readonly string[]).includes(value);

const languageOf = (name: string): Language | undefined => {
  const lang = name === "bash" ? "sh" : name;
  return isLanguage(lang) ? lang : undefined;
};

/** GitHub-style heading ids, so the links between the docs keep working. */
const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, "")
    .trim()
    .replace(/ /g, "-");

export type DocHeading = { id: string; text: string };

type Options = {
  /** The repository root: links out of the docs go to GitHub. */
  repoRoot: string;
  /** The folder whose Markdown files are pages of the site. */
  docsDir: string;
};

export const content = ({ repoRoot, docsDir }: Options): Plugin => {
  const highlighter = createHighlighter({
    themes: [theme],
    langs: [...languages],
  });

  const highlight = async (code: string, lang: Language | undefined) => {
    if (!lang)
      return `<pre class="shiki"><code>${escapeHtml(code)}</code></pre>`;
    return (await highlighter).codeToHtml(code, { lang, theme: "sheet" });
  };

  /** A link in a Markdown file, as a route of the site or a GitHub URL. */
  const linkTarget = (href: string, file: string): string => {
    // README.md links to the published site, so it works on npm and GitHub;
    // on the site itself those links stay routes of the current build.
    if (href.startsWith(SITE)) return href.slice(SITE.length) || "#/";
    if (/^[a-z]+:/i.test(href)) return href;
    const [path, anchor] = href.split("#");
    // "#section" alone is a link into the page itself.
    const target = path ? resolve(dirname(file), path) : file;
    const inRepo = relative(repoRoot, target);
    const suffix = anchor ? `#${anchor}` : "";
    if (inRepo === "README.md") return `#/docs/getting-started${suffix}`;
    if (dirname(target) === docsDir && extname(target) === ".md") {
      const slug = basename(target, ".md");
      return slug === "README" ? "#/docs" : `#/docs/${slug}${suffix}`;
    }
    const kind = extname(target) ? "blob" : "tree";
    return `${REPOSITORY}/${kind}/main/${inRepo}`;
  };

  const renderDoc = async (file: string) => {
    const headings: DocHeading[] = [];
    const blocks = new WeakMap<Tokens.Code, string>();
    let title = "";

    const marked = new Marked({
      async: true,
      walkTokens: async (token) => {
        if (token.type !== "code") return;
        const code = token as Tokens.Code;
        blocks.set(
          code,
          await highlight(code.text, languageOf(code.lang ?? "")),
        );
      },
      renderer: {
        code(token) {
          return blocks.get(token) ?? "";
        },
        heading({ tokens, depth, text }) {
          const plain = text.replace(/`/g, "");
          const id = slugify(plain);
          if (depth === 1) title = plain;
          if (depth === 2) headings.push({ id, text: plain });
          return `<h${depth} id="${id}">${this.parser.parseInline(tokens)}</h${depth}>\n`;
        },
        link({ href, tokens }) {
          const target = linkTarget(href, file);
          const external = /^https?:/.test(target) ? ' rel="noreferrer"' : "";
          return `<a href="${target}"${external}>${this.parser.parseInline(tokens)}</a>`;
        },
      },
    });

    const html = (await marked.parse(await readFile(file, "utf8")))
      .replace(/<table>/g, '<div class="table-wrap"><table>')
      .replace(/<\/table>/g, "</table></div>");
    return { title, html, headings };
  };

  const renderCode = async (file: string) => {
    const code = await readFile(file, "utf8");
    const lang = languageOf(extname(file).slice(1));
    return {
      name: basename(file),
      html: await highlight(code.trimEnd(), lang),
    };
  };

  return {
    name: "xoe-site-content",
    enforce: "pre",
    resolveId(source, importer) {
      const match = /^(.*)\?(code|doc)$/.exec(source);
      if (!match || !importer) return null;
      const file = resolve(dirname(importer.split("?")[0]), match[1]);
      return (match[2] === "code" ? CODE : DOC) + file;
    },
    async load(id) {
      const prefix = [CODE, DOC].find((value) => id.startsWith(value));
      if (!prefix) return null;
      const file = id.slice(prefix.length);
      this.addWatchFile(file);
      const data =
        prefix === CODE ? await renderCode(file) : await renderDoc(file);
      return `export default ${JSON.stringify(data)};`;
    },
  };
};
