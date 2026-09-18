import "server-only";
import { readFile } from "node:fs/promises";
import {
  AccessError,
  authorizeWorkspace,
  PolicySchema,
  verifyIdentity,
} from "./access";
import { briefRepository, readJsonFile } from "./provider";
import { buildDashboard, normalizeQuery } from "./briefs";

export async function loadDashboard(
  input: Record<string, string | string[] | undefined>,
  headers: Headers,
) {
  const mode = process.env.STRIDE_AUTH_MODE ?? "demo";
  if (!["demo", "gateway"].includes(mode)) throw new AccessError(503);
  let personId = "zhiyuan";
  let grant;
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
  if (grant) {
    const scalar = (key: string) =>
      Array.isArray(input[key]) ? input[key][0] : input[key];
    const id = scalar("id");
    const view = scalar("view") ?? "projects";
    const scope = scalar("scope");
    if (
      scope &&
      scope !== "all" &&
      !workspace.groups.some((g) => g.id === scope)
    )
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
  const dashboard = buildDashboard(
    workspace,
    normalizeQuery(input, workspace, personId),
  );
  dashboard.session = {
    mode: mode as "demo" | "gateway",
    personId,
    synthetic: !process.env.STRIDE_WORKSPACE_FILE,
  };
  return dashboard;
}
