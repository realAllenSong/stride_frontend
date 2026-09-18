import { z } from "zod";
import {
  DateSchema,
  QuerySchema,
  type Change,
  type Dashboard,
  type DeliveryPlan,
  type Evidence,
  type Workspace,
} from "./contracts";
import { bounds, type Period } from "./dates";
import { currentMilestone, plansAt } from "./delivery";
import { buildDashboard, descendants, normalizeQuery } from "./briefs";
import { latestPerWork } from "./work";
import { streamsOf } from "./digest";

/** Read-only projections for agents and the CLI. Everything here consumes an already
 *  authorized workspace; nothing widens visibility or loads raw private records. */

export const AsOfQuery = z.object({ date: DateSchema.optional() });
export const ScopedQuery = AsOfQuery.extend({
  scope: z.string().max(80).optional(),
});
export const PeriodQuery = AsOfQuery.extend({
  period: z.enum(["daily", "weekly", "monthly", "yearly"]).default("weekly"),
});
export const PeopleQuery = PeriodQuery.extend({
  scope: z.string().max(80).optional(),
});
export const BriefQuery = QuerySchema.pick({
  view: true,
  scope: true,
  id: true,
  period: true,
  date: true,
});

export class NotFound extends Error {
  constructor(public resource: string) {
    super(`${resource} not found`);
  }
}

const unique = <T>(values: T[]): T[] => [...new Set(values)];
const clampEnd = (workspace: Workspace, date?: string) =>
  !date || date > workspace.asOf ? workspace.asOf : date;
const historyUntil = (workspace: Workspace, end: string): Change[] =>
  workspace.dailyBriefs
    .filter((b) => b.date <= end)
    .flatMap((b) => b.changes);
const personSummary = (workspace: Workspace, id: string) => {
  const p = workspace.people.find((p) => p.id === id);
  return p && { id: p.id, name: p.name, role: p.role, groupId: p.groupId };
};
const evidenceSummary = (e: Evidence) => ({
  id: e.id,
  date: e.date,
  title: e.title,
  source: e.source,
  basis: e.basis,
  restricted: e.restricted,
});

export function workspaceOverview(
  workspace: Workspace,
  session: Dashboard["session"],
) {
  return {
    asOf: workspace.asOf,
    session,
    groups: workspace.groups,
    people: workspace.people.map((p) => ({
      id: p.id,
      name: p.name,
      role: p.role,
      groupId: p.groupId,
      reportsTo: p.reportsTo,
    })),
    projects: workspace.projects.map((p) => ({
      id: p.id,
      name: p.name,
      groupId: p.groupId,
      purpose: p.purpose,
      ownerIds: p.ownerIds,
    })),
    sources: workspace.sourceStates ?? [],
    counts: {
      dailyBriefs: workspace.dailyBriefs.length,
      evidence: workspace.evidence.length,
      deliveryPlans: workspace.deliveryPlans?.length ?? 0,
    },
  };
}

function planSummary(plan: DeliveryPlan) {
  const gate = currentMilestone(plan);
  return {
    id: plan.id,
    asOf: plan.asOf,
    headline: plan.headline,
    objective: plan.objective,
    decision: plan.decision,
    currentMilestone: {
      id: gate.id,
      title: gate.title,
      state: gate.state,
      target: gate.target,
    },
    milestones: {
      accepted: plan.milestones.filter((m) => m.state === "complete").length,
      total: plan.milestones.length,
    },
    tasks: {
      planned: plan.tasks.filter((t) => t.status === "planned").length,
      doing: plan.tasks.filter((t) => t.status === "doing").length,
      review: plan.tasks.filter((t) => t.status === "review").length,
      done: plan.tasks.filter((t) => t.status === "done").length,
    },
    blockers: plan.tasks
      .filter((t) => t.blocker)
      .map((t) => ({ taskId: t.id, title: t.title, blocker: t.blocker! })),
  };
}

export function listProjects(
  workspace: Workspace,
  input: { date?: string; scope?: string },
) {
  const end = clampEnd(workspace, input.date);
  const plans = new Map(
    plansAt(workspace.deliveryPlans, end).map((p) => [p.projectId, p]),
  );
  const history = latestPerWork(historyUntil(workspace, end));
  return {
    asOf: end,
    projects: workspace.projects
      .filter((p) => !input.scope || input.scope === "all" || p.groupId === input.scope)
      .map((p) => {
        const latest = history.find((c) => c.projectId === p.id);
        const plan = plans.get(p.id);
        return {
          id: p.id,
          name: p.name,
          groupId: p.groupId,
          purpose: p.purpose,
          owners: p.ownerIds.map((id) => personSummary(workspace, id)).filter(Boolean),
          plan: plan ? planSummary(plan) : undefined,
          latest: latest && {
            date: latest.date,
            title: latest.title,
            basis: latest.basis,
          },
        };
      }),
  };
}

export function projectDetail(
  workspace: Workspace,
  id: string,
  input: { date?: string },
) {
  const project = workspace.projects.find((p) => p.id === id);
  if (!project) throw new NotFound("project");
  const end = clampEnd(workspace, input.date);
  const plan = plansAt(workspace.deliveryPlans, end).find(
    (p) => p.projectId === id,
  );
  const changes = latestPerWork(
    historyUntil(workspace, end).filter((c) => c.projectId === id),
  );
  const evidenceIds = unique([
    ...changes.flatMap((c) => c.evidenceIds),
    ...(plan
      ? [
          ...plan.tasks.flatMap((t) => t.evidenceIds),
          ...plan.milestones.flatMap((m) => m.criteria.flatMap((c) => c.evidenceIds)),
          ...plan.resources.flatMap((r) => r.evidenceIds),
        ]
      : []),
  ]);
  return {
    asOf: end,
    project: {
      ...project,
      owners: project.ownerIds.map((pid) => personSummary(workspace, pid)).filter(Boolean),
    },
    plan,
    streams: streamsOf(historyUntil(workspace, end).filter((c) => c.projectId === id)),
    latestChanges: changes,
    evidence: workspace.evidence
      .filter((e) => evidenceIds.includes(e.id) && e.date <= end)
      .map(evidenceSummary),
    related: (plan?.relatedProjects ?? []).map((r) => ({
      ...r,
      name: workspace.projects.find((p) => p.id === r.projectId)?.name,
    })),
  };
}

export type GraphNode = {
  id: string;
  kind:
    | "project"
    | "group"
    | "milestone"
    | "task"
    | "resource"
    | "person"
    | "evidence";
  label: string;
  state?: string;
  projectId?: string;
};
export type GraphEdge = {
  from: string;
  to: string;
  kind:
    | "in-group"
    | "owns"
    | "has-milestone"
    | "has-task"
    | "depends-on"
    | "assigned-to"
    | "documented-by"
    | "evidenced-by"
    | "related-to"
    | "contributed-to"
    | "reports-to";
  label?: string;
};

function planGraph(
  workspace: Workspace,
  plan: DeliveryPlan,
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const pid = `project:${plan.projectId}`;
  for (const m of plan.milestones) {
    nodes.push({
      id: `milestone:${m.id}`,
      kind: "milestone",
      label: m.title,
      state: m.state,
      projectId: plan.projectId,
    });
    edges.push({ from: pid, to: `milestone:${m.id}`, kind: "has-milestone" });
    for (const e of unique(m.criteria.flatMap((c) => c.evidenceIds)))
      edges.push({ from: `milestone:${m.id}`, to: `evidence:${e}`, kind: "evidenced-by" });
  }
  for (const t of plan.tasks) {
    nodes.push({
      id: `task:${t.id}`,
      kind: "task",
      label: `${t.id} ${t.title}`,
      state: t.status,
      projectId: plan.projectId,
    });
    edges.push({ from: `milestone:${t.milestoneId}`, to: `task:${t.id}`, kind: "has-task" });
    for (const d of t.dependsOn)
      edges.push({ from: `task:${t.id}`, to: `task:${d}`, kind: "depends-on" });
    if (t.ownerId)
      edges.push({ from: `task:${t.id}`, to: `person:${t.ownerId}`, kind: "assigned-to" });
    for (const e of t.evidenceIds)
      edges.push({ from: `task:${t.id}`, to: `evidence:${e}`, kind: "evidenced-by" });
  }
  for (const r of plan.resources) {
    nodes.push({
      id: `resource:${r.id}`,
      kind: "resource",
      label: r.title,
      state: r.kind,
      projectId: plan.projectId,
    });
    for (const t of r.taskIds)
      edges.push({ from: `task:${t}`, to: `resource:${r.id}`, kind: "documented-by" });
  }
  for (const rel of plan.relatedProjects)
    edges.push({
      from: pid,
      to: `project:${rel.projectId}`,
      kind: "related-to",
      label: rel.relation,
    });
  return { nodes, edges };
}

function attachReferenced(
  workspace: Workspace,
  nodes: GraphNode[],
  edges: GraphEdge[],
  end: string,
) {
  const ids = new Set(nodes.map((n) => n.id));
  for (const edge of edges) {
    for (const ref of [edge.from, edge.to]) {
      if (ids.has(ref)) continue;
      const [kind, id] = ref.split(":", 2);
      if (kind === "person") {
        const p = personSummary(workspace, id);
        if (p) nodes.push({ id: ref, kind: "person", label: p.name, state: p.role });
      } else if (kind === "evidence") {
        const e = workspace.evidence.find((e) => e.id === id && e.date <= end);
        if (e)
          nodes.push({
            id: ref,
            kind: "evidence",
            label: e.title,
            state: e.basis,
            projectId: e.projectId,
          });
      } else if (kind === "project") {
        const p = workspace.projects.find((p) => p.id === id);
        if (p) nodes.push({ id: ref, kind: "project", label: p.name, projectId: p.id });
      }
      ids.add(ref);
    }
  }
  const known = new Set(nodes.map((n) => n.id));
  return {
    nodes,
    edges: edges.filter((e) => known.has(e.from) && known.has(e.to)),
  };
}

export function projectGraph(
  workspace: Workspace,
  id: string,
  input: { date?: string },
) {
  const project = workspace.projects.find((p) => p.id === id);
  if (!project) throw new NotFound("project");
  const end = clampEnd(workspace, input.date);
  const nodes: GraphNode[] = [
    { id: `project:${id}`, kind: "project", label: project.name, projectId: id },
  ];
  const edges: GraphEdge[] = project.ownerIds.map((pid) => ({
    from: `person:${pid}`,
    to: `project:${id}`,
    kind: "owns" as const,
  }));
  const plan = plansAt(workspace.deliveryPlans, end).find((p) => p.projectId === id);
  if (plan) {
    const g = planGraph(workspace, plan);
    nodes.push(...g.nodes);
    edges.push(...g.edges);
  }
  for (const c of latestPerWork(
    historyUntil(workspace, end).filter((c) => c.projectId === id),
  ))
    for (const x of c.contributions)
      edges.push({
        from: `person:${x.personId}`,
        to: `project:${id}`,
        kind: "contributed-to",
        label: x.description,
      });
  return { asOf: end, planAsOf: plan?.asOf, ...attachReferenced(workspace, nodes, edges, end) };
}

export function workspaceGraph(workspace: Workspace, input: { date?: string }) {
  const end = clampEnd(workspace, input.date);
  const nodes: GraphNode[] = [
    ...workspace.groups.map((g) => ({ id: `group:${g.id}`, kind: "group" as const, label: g.name })),
    ...workspace.projects.map((p) => ({
      id: `project:${p.id}`,
      kind: "project" as const,
      label: p.name,
      projectId: p.id,
    })),
    ...workspace.people.map((p) => ({
      id: `person:${p.id}`,
      kind: "person" as const,
      label: p.name,
      state: p.role,
    })),
  ];
  const edges: GraphEdge[] = [
    ...workspace.projects.map((p) => ({
      from: `project:${p.id}`,
      to: `group:${p.groupId}`,
      kind: "in-group" as const,
    })),
    ...workspace.projects.flatMap((p) =>
      p.ownerIds.map((pid) => ({ from: `person:${pid}`, to: `project:${p.id}`, kind: "owns" as const })),
    ),
    ...workspace.people.flatMap((p) =>
      p.reportsTo ? [{ from: `person:${p.id}`, to: `person:${p.reportsTo}`, kind: "reports-to" as const }] : [],
    ),
  ];
  for (const plan of plansAt(workspace.deliveryPlans, end)) {
    const gate = currentMilestone(plan);
    nodes.push({
      id: `milestone:${gate.id}`,
      kind: "milestone",
      label: gate.title,
      state: gate.state,
      projectId: plan.projectId,
    });
    edges.push({ from: `project:${plan.projectId}`, to: `milestone:${gate.id}`, kind: "has-milestone" });
    for (const rel of plan.relatedProjects)
      edges.push({
        from: `project:${plan.projectId}`,
        to: `project:${rel.projectId}`,
        kind: "related-to",
        label: rel.relation,
      });
  }
  const seen = new Set<string>();
  for (const c of latestPerWork(historyUntil(workspace, end)))
    for (const x of c.contributions) {
      const key = `${x.personId}->${c.projectId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ from: `person:${x.personId}`, to: `project:${c.projectId}`, kind: "contributed-to" });
    }
  return { asOf: end, ...attachReferenced(workspace, nodes, edges, end) };
}

export function listPeople(
  workspace: Workspace,
  input: { date?: string; period: Period; scope?: string },
) {
  const end = clampEnd(workspace, input.date);
  const range = bounds(end, input.period);
  const changes = historyUntil(workspace, end).filter((c) => c.date >= range.start);
  const plans = plansAt(workspace.deliveryPlans, end);
  return {
    range: { start: range.start, end },
    people: workspace.people
      .filter((p) => !input.scope || input.scope === "all" || p.groupId === input.scope)
      .map((p) => {
        const mine = changes.filter((c) => c.contributions.some((x) => x.personId === p.id));
        return {
          id: p.id,
          name: p.name,
          role: p.role,
          groupId: p.groupId,
          reportsTo: p.reportsTo,
          manages: workspace.people.filter((x) => x.reportsTo === p.id).length,
          updates: mine.length,
          recordedDays: unique(mine.map((c) => c.date)).length,
          projectIds: unique(mine.map((c) => c.projectId)),
          tasksOwned: plans.flatMap((plan) => plan.tasks.filter((t) => t.ownerId === p.id)).length,
        };
      }),
  };
}

export function personDetail(
  workspace: Workspace,
  id: string,
  input: { date?: string; period: Period },
) {
  const person = workspace.people.find((p) => p.id === id);
  if (!person) throw new NotFound("person");
  const dashboard = buildDashboard(
    workspace,
    normalizeQuery({ view: "people", id, period: input.period, date: input.date ?? workspace.asOf }, workspace),
  );
  const own = dashboard.periodChanges.filter((c) =>
    c.contributions.some((x) => x.personId === id),
  );
  const reports = descendants(workspace.people, id);
  const plans = dashboard.workspace.deliveryPlans ?? [];
  return {
    range: dashboard.range,
    person: {
      ...person,
      reportsTo: personSummary(workspace, person.reportsTo ?? ""),
      manages: reports.map((r) => personSummary(workspace, r)).filter(Boolean),
    },
    headline: dashboard.copy?.headline,
    summary: dashboard.copy?.summary,
    streams: streamsOf(own),
    contributions: own.map((c) => ({
      changeId: c.id,
      date: c.date,
      projectId: c.projectId,
      title: c.title,
      description: c.contributions.find((x) => x.personId === id)!.description,
      basis: c.contributions.find((x) => x.personId === id)!.basis,
      evidenceIds: c.evidenceIds,
    })),
    tasksOwned: plans.flatMap((plan) =>
      plan.tasks
        .filter((t) => t.ownerId === id)
        .map((t) => ({
          ...t,
          projectId: plan.projectId,
          milestone: plan.milestones.find((m) => m.id === t.milestoneId)?.title,
          planAsOf: plan.asOf,
        })),
    ),
    nextSteps: own.filter((c) => c.nextStep).map((c) => ({ projectId: c.projectId, ...c.nextStep! })),
    collaborators: unique(
      own.flatMap((c) => c.contributions.map((x) => x.personId)).filter((x) => x !== id),
    )
      .map((x) => personSummary(workspace, x))
      .filter(Boolean),
    teamChanges: dashboard.currentChanges
      .filter((c) => !own.some((o) => o.id === c.id))
      .map((c) => ({
        changeId: c.id,
        date: c.date,
        projectId: c.projectId,
        title: c.title,
        contributions: c.contributions,
      })),
  };
}

export function periodBrief(workspace: Workspace, input: z.infer<typeof BriefQuery>, personId = "zhiyuan") {
  const dashboard = buildDashboard(workspace, normalizeQuery(input, workspace, personId));
  const { query } = dashboard;
  return {
    subject: {
      view: query.view,
      id: query.id,
      scope: query.scope,
      name:
        dashboard.selectedProject?.name ??
        dashboard.selectedPerson?.name ??
        (query.scope === "all"
          ? "All groups"
          : workspace.groups.find((g) => g.id === query.scope)?.name),
    },
    period: query.period,
    range: dashboard.range,
    generated: !!dashboard.copy,
    headline: dashboard.copy?.headline,
    summary: dashboard.copy?.summary,
    copy: dashboard.copy,
    digest: dashboard.digest,
    changes: dashboard.periodChanges,
    lineage: { root: dashboard.root, nodes: dashboard.lineage },
    deliveryPlans: dashboard.workspace.deliveryPlans?.map(planSummary) ?? [],
    evidence: dashboard.workspace.evidence
      .filter((e) => dashboard.root.evidenceIds.includes(e.id))
      .map(evidenceSummary),
  };
}

export function evidenceRecord(workspace: Workspace, id: string, input: { date?: string }) {
  const end = clampEnd(workspace, input.date);
  const record = workspace.evidence.find((e) => e.id === id && e.date <= end);
  if (!record) throw new NotFound("evidence");
  const usedBy = workspace.dailyBriefs
    .flatMap((b) => b.changes)
    .filter((c) => c.date <= end && c.evidenceIds.includes(id))
    .map((c) => ({ changeId: c.id, date: c.date, title: c.title, projectId: c.projectId }));
  return { asOf: end, record, usedBy };
}

export function openApiDocument(baseUrl: string) {
  const date = { name: "date", in: "query", schema: { type: "string", format: "date" }, description: "As-of calendar date (YYYY-MM-DD). Defaults to the latest snapshot. Later dates never reveal later results." };
  const period = { name: "period", in: "query", schema: { type: "string", enum: ["daily", "weekly", "monthly", "yearly"], default: "weekly" } };
  const scope = { name: "scope", in: "query", schema: { type: "string" }, description: "Group ID or 'all'." };
  const id = (name: string) => ({ name: "id", in: "path", required: true, schema: { type: "string" }, description: `${name} ID` });
  const ok = (description: string) => ({ "200": { description }, "401": { description: "Sign-in required (gateway mode)" }, "403": { description: "Access not granted" }, "404": { description: "Not found in the authorized workspace" } });
  return {
    openapi: "3.1.0",
    info: {
      title: "STRIDE read-only API",
      version: "1.0.0",
      description:
        "Evidence-backed work briefs for people and agents. Every response is scoped by server-owned grants; the URL never widens visibility. No write operations exist.",
    },
    servers: [{ url: baseUrl }],
    security: [{ bearer: [] }],
    components: { securitySchemes: { bearer: { type: "http", scheme: "bearer", bearerFormat: "JWT" } } },
    paths: {
      "/api/health": { get: { summary: "Liveness", responses: { "200": { description: "OK" } } } },
      "/api/v1/workspace": { get: { summary: "Groups, people, projects and source availability in scope", responses: ok("Workspace overview") } },
      "/api/v1/projects": { get: { summary: "Projects with current delivery gate and latest recorded change", parameters: [date, scope], responses: ok("Project list") } },
      "/api/v1/projects/{id}": { get: { summary: "One project: plan snapshot, work streams, latest changes, evidence", parameters: [id("Project"), date], responses: ok("Project detail") } },
      "/api/v1/projects/{id}/graph": { get: { summary: "Project relationship graph (milestones, tasks, dependencies, owners, evidence, related projects)", parameters: [id("Project"), date], responses: ok("Graph with nodes and edges") } },
      "/api/v1/graph": { get: { summary: "Workspace graph: groups, projects, people, current gates and cross-project relations", parameters: [date], responses: ok("Graph with nodes and edges") } },
      "/api/v1/people": { get: { summary: "People with record coverage for a period", parameters: [date, period, scope], responses: ok("People list") } },
      "/api/v1/people/{id}": { get: { summary: "One person: streams, contributions, owned tasks, collaborators, reporting line", parameters: [id("Person"), date, period], responses: ok("Person detail") } },
      "/api/v1/briefs": {
        get: {
          summary: "Period brief for a project, group or person: headline, bounded copy, digest and lineage",
          parameters: [
            { name: "view", in: "query", schema: { type: "string", enum: ["projects", "people"], default: "projects" } },
            { name: "id", in: "query", schema: { type: "string", default: "all" }, description: "Project or person ID, or 'all'" },
            scope,
            period,
            date,
          ],
          responses: ok("Period brief"),
        },
      },
      "/api/v1/evidence/{id}": { get: { summary: "One evidence record and the changes that cite it", parameters: [id("Evidence"), date], responses: ok("Evidence record") } },
      "/api/brief": { get: { summary: "Full dashboard projection used by the UI", responses: ok("Dashboard") } },
    },
  };
}
