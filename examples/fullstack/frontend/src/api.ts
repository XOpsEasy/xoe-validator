import type { XOEIssue } from "@xopseasy/xoe-validator";
import type { IsUsernameFree } from "../../shared/schemas.ts";

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; issues: readonly XOEIssue[] };

/** POSTs JSON; a 400 answer has the issues as data (see backend/app.ts). */
export const post = async <T,>(url: string, body: unknown): Promise<ApiResult<T>> => {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  return response.ok ? { ok: true, data: json } : { ok: false, issues: json.issues };
};

/** The frontend asks the API whether a username is free. */
export const isUsernameFree: IsUsernameFree = async (username, signal) => {
  const response = await fetch(
    `/api/users/available/${encodeURIComponent(username)}`,
    { signal },
  );
  return (await response.json()).available;
};
