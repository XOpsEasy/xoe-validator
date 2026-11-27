// Hash routes ("#/docs/async#cancelling"): the site works from any folder of
// a static host. The part after a second "#" is a heading on the page.
import { useSyncExternalStore } from "react";

export type Route = { path: string; anchor?: string };

const subscribe = (onChange: () => void) => {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
};

const parse = (hash: string): Route => {
  const [path, anchor] = hash.replace(/^#/, "").split("#");
  return { path: path.replace(/\/$/, "") || "/", anchor };
};

export const useRoute = (): Route =>
  parse(useSyncExternalStore(subscribe, () => window.location.hash));

export const href = (path: string) => `#${path}`;
