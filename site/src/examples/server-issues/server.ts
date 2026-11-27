// Stands in for a backend route. With Hono or Express it's the same code:
// validate the body, answer 400 with the issues, or go on with the output.
import type { XOEIssue } from "@x-ops-easy/xoe-validator";
import { type Workspace, workspaceSchema } from "./schema.ts";

const existing = ["acme", "foleon"];

export type Response =
  | { status: 201; body: { workspace: Workspace } }
  | { status: 400; body: { issues: readonly XOEIssue[] } };

const handle = (body: unknown): Response => {
  // The server validates again: the browser's check is for the user, this
  // one is the check that counts.
  const result = workspaceSchema.validate(body);
  if (result.type === "error") {
    return { status: 400, body: { issues: result.value } };
  }
  // What only the server knows is an issue too, in the same format.
  if (existing.includes(result.value.workspace)) {
    const issue: XOEIssue = {
      code: "workspace.taken",
      message: "This workspace name is taken.",
      path: ["workspace"],
    };
    return { status: 400, body: { issues: [issue] } };
  }
  return { status: 201, body: { workspace: result.value } };
};

/** POST /api/workspaces; the request and the response travel as JSON. */
export const createWorkspace = async (values: unknown): Promise<Response> => {
  await new Promise((resolve) => setTimeout(resolve, 400));
  const response = handle(JSON.parse(JSON.stringify(values)));
  return JSON.parse(JSON.stringify(response));
};
