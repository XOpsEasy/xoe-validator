import { Suspense, use, useEffect } from "react";
import { NotFound } from "../App.tsx";
import { docTitle } from "../docs.ts";
import {
  type Example,
  exampleComponent,
  examples,
  exampleSources,
  findExample,
} from "../examples/index.ts";
import { href } from "../lib/router.ts";
import { Code } from "../ui/Code.tsx";
import { Prose } from "../ui/Prose.tsx";

const Sources = ({ example }: { example: Example }) => (
  <Code files={use(exampleSources(example))} />
);

const Neighbours = ({ example }: { example: Example }) => {
  const index = examples.indexOf(example);
  const previous = examples[index - 1];
  const next = examples[index + 1];
  return (
    <nav className="neighbours" aria-label="More examples">
      {previous ? (
        <a href={href(`/examples/${previous.slug}`)}>
          Previous: {previous.title}
        </a>
      ) : (
        <span />
      )}
      {next && <a href={href(`/examples/${next.slug}`)}>Next: {next.title}</a>}
    </nav>
  );
};

export const ExamplePage = ({ slug }: { slug: string }) => {
  const example = findExample(slug);

  useEffect(() => {
    if (example) document.title = `${example.title} - xoe-validator`;
  }, [example]);

  if (!example) return <NotFound />;
  const Demo = exampleComponent(slug);

  return (
    <article className="example">
      <header className="example-head">
        <h1>{example.title}</h1>
        <p className="lead">{example.summary}</p>
      </header>

      {/* The key gives every example its own state. */}
      <Demo key={slug} />

      <div className="example-notes">
        <section>
          <h2>What it shows</h2>
          <ul>
            {example.notes.map((note) => (
              <li key={note}>
                <Prose text={note} />
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2>Things to try</h2>
          <ul>
            {example.tryIt.map((item) => (
              <li key={item}>
                <Prose text={item} />
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section>
        <h2>The code</h2>
        <p>
          This is the code that runs above, as it is in the repository. Read
          more in{" "}
          {example.docs.map((doc, index) => (
            <span key={doc}>
              {index > 0 &&
                (index === example.docs.length - 1 ? " and " : ", ")}
              <a href={href(`/docs/${doc}`)}>{docTitle(doc)}</a>
            </span>
          ))}
          .
        </p>
        <Suspense fallback={<p className="loading">Loading the code</p>}>
          <Sources example={example} />
        </Suspense>
      </section>

      <Neighbours example={example} />
    </article>
  );
};
