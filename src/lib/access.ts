import { importSPKI, jwtVerify } from "jose";
import { z } from "zod";
import { Id, type Workspace } from "./contracts";

export class AccessError extends Error {
  constructor(public status: 401 | 403 | 503) {
    super(
      status === 503
        ? "Workspace unavailable"
        : status === 401
          ? "Sign-in required"
          : "Access not granted",
    );
  }
}
export const PolicySchema = z
  .strictObject({
    principals: z
      .array(
        z.strictObject({
          subject: z.string().min(1).max(300),
          personId: Id,
          groupIds: z.array(Id),
          projectIds: z.array(Id).default([]),
        }),
      )
      .max(10000),
  })
  .superRefine((p, ctx) => {
    if (
      new Set(p.principals.map((x) => x.subject)).size !== p.principals.length
    )
      ctx.addIssue({ code: "custom", message: "Duplicate identity mapping" });
  });
export type Grant = z.infer<typeof PolicySchema>["principals"][number];
export async function verifyIdentity(
  token: string,
  config: { publicKey: string; issuer: string; audience: string },
): Promise<string> {
  try {
    const key = await importSPKI(config.publicKey, "RS256");
    const { payload } = await jwtVerify(token, key, {
      issuer: config.issuer,
      audience: config.audience,
      algorithms: ["RS256"],
      requiredClaims: ["sub", "exp", "iat"],
      maxTokenAge: "1h",
      clockTolerance: 5,
    });
    if (!payload.sub) throw new Error("Missing subject");
    return payload.sub;
  } catch {
    throw new AccessError(401);
  }
}

/** Server-owned grants, never the URL, define visibility. This runs before serialization. */
export function authorizeWorkspace(
  workspace: Workspace,
  grant: Grant,
): Workspace {
  if (
    !workspace.people.some((p) => p.id === grant.personId) ||
    grant.groupIds.some((id) => !workspace.groups.some((g) => g.id === id)) ||
    grant.projectIds.some((id) => !workspace.projects.some((p) => p.id === id))
  )
    throw new AccessError(403);
  const projects = workspace.projects.filter(
    (p) =>
      grant.groupIds.includes(p.groupId) || grant.projectIds.includes(p.id),
  );
  const projectIds = new Set(projects.map((p) => p.id));
  const deliveryPlans = workspace.deliveryPlans
    ?.filter((p) => projectIds.has(p.projectId))
    .map((p) => ({
      ...p,
      relatedProjects: p.relatedProjects.filter((r) =>
        projectIds.has(r.projectId),
      ),
    }));
  const dailyBriefs = workspace.dailyBriefs
    .map((b) => ({
      ...b,
      headline: "Shared work updates",
      summary: "Approved updates within your access scope.",
      changes: b.changes.filter((c) => projectIds.has(c.projectId)),
    }))
    .filter((b) => b.changes.length);
  const personIds = new Set([
    grant.personId,
    ...projects.flatMap((p) => p.ownerIds),
    ...(deliveryPlans ?? []).flatMap((p) =>
      p.tasks.flatMap((t) => (t.ownerId ? [t.ownerId] : [])),
    ),
    ...dailyBriefs.flatMap((b) =>
      b.changes.flatMap((c) => c.contributions.map((p) => p.personId)),
    ),
    ...workspace.people
      .filter((p) => grant.groupIds.includes(p.groupId))
      .map((p) => p.id),
  ]);
  const people = workspace.people
    .filter((p) => personIds.has(p.id))
    .map((p) => ({
      ...p,
      reportsTo:
        p.reportsTo && personIds.has(p.reportsTo) ? p.reportsTo : undefined,
    }));
  const groupIds = new Set([
    ...grant.groupIds,
    ...projects.map((p) => p.groupId),
    ...people.map((p) => p.groupId),
  ]);
  return {
    ...workspace,
    projects,
    people,
    dailyBriefs,
    deliveryPlans,
    groups: workspace.groups.filter((g) => groupIds.has(g.id)),
    evidence: workspace.evidence.filter((e) => projectIds.has(e.projectId)),
    suggestions: workspace.suggestions?.filter(
      (s) =>
        s.personId === grant.personId &&
        dailyBriefs.some((b) => b.changes.some((c) => c.workId === s.workId)),
    ),
    // Group/person narratives may summarize a wider access scope. Use bounded facts instead.
    briefCopies: workspace.briefCopies?.filter(
      (c) => c.subject.kind === "projects" && projectIds.has(c.subject.id),
    ),
    sourceStates: workspace.sourceStates
      ?.map((s) => ({
        ...s,
        projectIds: s.projectIds.filter((id) => projectIds.has(id)),
      }))
      .filter((s) => s.projectIds.length),
  };
}
