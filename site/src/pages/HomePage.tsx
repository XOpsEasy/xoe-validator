import { useEffect } from "react";
import { exampleComponent } from "../examples/index.ts";
import { href } from "../lib/router.ts";
import { ExampleIndex } from "./ExamplesPage.tsx";

const points = [
  {
    title: "Issues are data",
    text: "Invalid data never throws. An issue has a code, a path, params and a message, so you can show it on a field, translate it or send it from an API.",
  },
  {
    title: "The output is parsed",
    text: "Trimmed strings, numbers and dates from form inputs, defaults filled in, unknown keys removed. The input and output types are inferred.",
  },
  {
    title: "One schema on both sides",
    text: "The browser and the server import the same schema. Async rules can be cancelled and are limited in how many run at once.",
  },
  {
    title: "It works with what you have",
    text: "JSON Schema and OpenAPI in both directions, Standard Schema for form libraries, messages in English and Serbian.",
  },
];

export const HomePage = () => {
  const Playground = exampleComponent("single-value");

  useEffect(() => {
    document.title = "xoe-validator";
  }, []);

  return (
    <article className="home">
      <header className="hero">
        <h1>Check a value. Get the output, or a list of what is wrong.</h1>
        <p className="lead">
          xoe-validator is a TypeScript validation library for forms and APIs.
          Change the value below: the yellow sheet is the parsed output, the
          pink sheet the issues.
        </p>
      </header>

      <Playground />

      <section className="points">
        {points.map((point) => (
          <div key={point.title}>
            <h2>{point.title}</h2>
            <p>{point.text}</p>
          </div>
        ))}
      </section>

      <section className="home-section">
        <h2>Examples</h2>
        <p>
          Working forms, from a login to a multi-step application, each with its
          code. New here? Start with{" "}
          <a href={href("/docs/getting-started")}>Getting started</a>.
        </p>
        <ExampleIndex />
      </section>
    </article>
  );
};
