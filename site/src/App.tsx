import { Suspense, useEffect, useState } from "react";
import logo from "/logo.svg";
import { docGroups } from "./docs.ts";
import { exampleGroups } from "./examples/index.ts";
import { href, useRoute } from "./lib/router.ts";
import { DocPage } from "./pages/DocPage.tsx";
import { ExamplePage } from "./pages/ExamplePage.tsx";
import { ExamplesPage } from "./pages/ExamplesPage.tsx";
import { HomePage } from "./pages/HomePage.tsx";

const REPOSITORY = "https://github.com/XOpsEasy/xoe-validator";

type NavLinkProps = { to: string; current: string; children: string };

const NavLink = ({ to, current, children }: NavLinkProps) => (
  <li>
    <a href={href(to)} aria-current={to === current ? "page" : undefined}>
      {children}
    </a>
  </li>
);

const Navigation = ({ current }: { current: string }) => (
  <nav className="nav" aria-label="Site">
    <ul>
      <NavLink to="/" current={current}>
        Overview
      </NavLink>
      <NavLink to="/examples" current={current}>
        All examples
      </NavLink>
    </ul>
    <h2>Examples</h2>
    {exampleGroups.map((group) => (
      <section key={group.title}>
        <h3>{group.title}</h3>
        <ul>
          {group.examples.map((example) => (
            <NavLink
              key={example.slug}
              to={`/examples/${example.slug}`}
              current={current}
            >
              {example.title}
            </NavLink>
          ))}
        </ul>
      </section>
    ))}
    <h2>Documentation</h2>
    {docGroups.map((group) => (
      <section key={group.title}>
        <h3>{group.title}</h3>
        <ul>
          {group.pages.map((page) => (
            <NavLink
              key={page.slug}
              to={`/docs/${page.slug}`}
              current={current}
            >
              {page.title}
            </NavLink>
          ))}
        </ul>
      </section>
    ))}
  </nav>
);

const Page = ({ path, anchor }: { path: string; anchor?: string }) => {
  const [, section, slug] = path.split("/");
  if (path === "/") return <HomePage />;
  if (section === "examples") {
    return slug ? <ExamplePage slug={slug} /> : <ExamplesPage />;
  }
  if (section === "docs")
    return <DocPage slug={slug ?? "README"} anchor={anchor} />;
  return <NotFound />;
};

export const NotFound = () => (
  <article className="prose">
    <h1>This page doesn't exist</h1>
    <p>
      The link may be old. The <a href={href("/")}>overview</a> lists the
      examples and the documentation.
    </p>
  </article>
);

export const App = () => {
  const route = useRoute();
  const [menuOpen, setMenuOpen] = useState(false);

  // A new page starts at the top; DocPage scrolls to its anchor itself.
  useEffect(() => {
    setMenuOpen(false);
    if (!route.anchor) window.scrollTo(0, 0);
  }, [route.path, route.anchor]);

  return (
    <div className="layout">
      <header className="sidebar">
        <div className="brand">
          <a href={href("/")} className="brand-name">
            <img src={logo} alt="" width="30" height="30" />
            xoe-validator
          </a>
          <button
            type="button"
            className="menu-button"
            aria-expanded={menuOpen}
            aria-controls="site-menu"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? "Close menu" : "Menu"}
          </button>
        </div>
        <div id="site-menu" className={menuOpen ? "menu menu-open" : "menu"}>
          <Navigation current={route.path} />
          <p className="nav-foot">
            <a href={REPOSITORY} rel="noreferrer">
              Source on GitHub
            </a>
          </p>
        </div>
      </header>
      <main className="main">
        <Suspense fallback={<p className="loading">Loading the page</p>}>
          <Page path={route.path} anchor={route.anchor} />
        </Suspense>
      </main>
    </div>
  );
};
