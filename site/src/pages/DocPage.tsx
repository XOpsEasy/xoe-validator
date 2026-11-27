import { use, useEffect } from "react";
import { NotFound } from "../App.tsx";
import { loadDoc } from "../docs.ts";
import { href } from "../lib/router.ts";

type Props = { slug: string; anchor?: string };

export const DocPage = ({ slug, anchor }: Props) => {
  const promise = loadDoc(slug);
  return promise ? (
    <Loaded slug={slug} anchor={anchor} promise={promise} />
  ) : (
    <NotFound />
  );
};

type LoadedProps = Props & { promise: NonNullable<ReturnType<typeof loadDoc>> };

const Loaded = ({ slug, anchor, promise }: LoadedProps) => {
  const page = use(promise);

  useEffect(() => {
    document.title = `${page.title} - xoe-validator`;
    if (anchor) document.getElementById(anchor)?.scrollIntoView();
  }, [page, anchor]);

  return (
    <div className="doc">
      <article
        className="prose"
        // Built from the repository's own Markdown by plugins/content.ts.
        dangerouslySetInnerHTML={{ __html: page.html }}
      />
      {page.headings.length > 1 && (
        <aside className="toc" aria-label="On this page">
          <h2>On this page</h2>
          <ul>
            {page.headings.map((heading) => (
              <li key={heading.id}>
                <a href={`${href(`/docs/${slug}`)}#${heading.id}`}>
                  {heading.text}
                </a>
              </li>
            ))}
          </ul>
        </aside>
      )}
    </div>
  );
};
