import { useEffect } from "react";
import { exampleGroups } from "../examples/index.ts";
import { href } from "../lib/router.ts";

export const ExampleIndex = () => (
  <div className="index">
    {exampleGroups.map((group) => (
      <section key={group.title} className="index-group">
        <h3>{group.title}</h3>
        <ul>
          {group.examples.map((example) => (
            <li key={example.slug}>
              <a href={href(`/examples/${example.slug}`)}>{example.title}</a>
              <span>{example.summary}</span>
            </li>
          ))}
        </ul>
      </section>
    ))}
  </div>
);

export const ExamplesPage = () => {
  useEffect(() => {
    document.title = "Examples - xoe-validator";
  }, []);

  return (
    <article className="example">
      <header className="example-head">
        <h1>Examples</h1>
        <p className="lead">
          Every example is a working form. Next to it you see what the validator
          returns while you type, and under it the code.
        </p>
      </header>
      <ExampleIndex />
    </article>
  );
};
