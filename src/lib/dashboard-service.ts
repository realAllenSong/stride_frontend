import "server-only";
import { readFile } from "node:fs/promises";
import {
  AccessError,
  authorizeWorkspace,
  PolicySchema,
  verifyIdentity,
  type Grant,
} from "./access";
import { briefRepository, readJsonFile } from "./provider";
import { buildDashboard, normalizeQuery } from "./briefs";
import type { Dashboard, Workspace } from "./contracts";

export interface Access {
  workspace: Workspace;
  grant?: Grant;
  session: NonNullable<Dashboard["session"]>;
}

/** Verify identity, apply server-owned grants and return the authorized workspace.
 *  Every page and API projection starts here; the URL never widens visibility. */
export async function loadAccess(headers: Headers): Promise<Access> {
  const mode = process.env.STRIDE_AUTH_MODE ?? "demo";
  if (!["demo", "gateway"].includes(mode)) throw new AccessError(503);
  let personId = "zhiyuan";
  let grant: Grant | undefined;
  if (mode === "gateway") {
    const {
      STRIDE_JWT_PUBLIC_KEY_FILE: keyFile,
      STRIDE_JWT_ISSUER: issuer,
      STRIDE_JWT_AUDIENCE: audience,
      STRIDE_ACCESS_POLICY_FILE: policyFile,
    } = process.env;
    if (!keyFile || !issuer || !audience || !policyFile)
      throw new AccessError(503);
    const authorization = headers.get("authorization") ?? "";
    if (!authorization.startsWith("Bearer ") || authorization.length > 16000)
      throw new AccessError(401);
    let publicKey: string;
    let policy;
    try {
      publicKey = await readFile(keyFile, "utf8");
      policy = PolicySchema.parse(await readJsonFile(policyFile, 1024 * 1024));
    } catch {
      throw new AccessError(503);
    }
    const subject = await verifyIdentity(authorization.slice(7), {
      publicKey,
      issuer,
      audience,
    });
    grant = policy.principals.find((p) => p.subject === subject);
    if (!grant) throw new AccessError(403);
    personId = grant.personId;
  }
  const original = await briefRepository.readWorkspace();
  const workspace = grant ? authorizeWorkspace(original, grant) : original;
  return {
    workspace,
    grant,
    session: {
      mode: mode as "demo" | "gateway",
      personId,
      synthetic: !process.env.STRIDE_WORKSPACE_FILE,
    },
  };
}

/** In gateway mode an explicit request for something outside the grant is a 403, not a silent fallback. */
export function assertScoped(
  access: Access,
  input: Record<string, string | string[] | undefined>,
) {
  if (!access.grant) return;
  const { workspace } = access;
  const scalar = (key: string) =>
    Array.isArray(input[key]) ? input[key][0] : input[key];
  const id = scalar("id");
  const view = scalar("view") ?? "projects";
  const scope = scalar("scope");
  if (scope && scope !== "all" && !workspace.groups.some((g) => g.id === scope))
    throw new AccessError(403);
  if (
    id &&
    id !== "all" &&
    view !== "self" &&
    !(view === "projects" ? workspace.projects : workspace.people).some(
      (p) => p.id === id,
    )
  )
    throw new AccessError(403);
  if (scalar("scenario") && scalar("scenario") !== "normal")
    throw new AccessError(403);
}

export async function loadDashboard(
  input: Record<string, string | string[] | undefined>,
  headers: Headers,
) {
  const access = await loadAccess(headers);
  assertScoped(access, input);
  const dashboard = buildDashboard(
    access.workspace,
    normalizeQuery(input, access.workspace, access.session.personId),
  );
  dashboard.session = access.session;
  return dashboard;
}
