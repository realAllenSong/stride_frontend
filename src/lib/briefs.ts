import { bounds, addDays, type Period } from "./dates";
import { createHash } from "node:crypto";
import { latestPerWork } from "./work";
import { plansAt, validateDelivery } from "./delivery";
import { buildDigest, subjectKey } from "./digest";
export { latestPerWork } from "./work";
import {
  QuerySchema,
  type Workspace,
  type Query,
  type Dashboard,
  type Change,
  type BriefNode,
  type Person,
  type BriefCopy,
} from "./contracts";

const unique = <T>(values: T[]): T[] => [...new Set(values)];
const revision = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const levelBelow: Record<Exclude<Period, "daily">, Period> = {
  weekly: "daily",
  monthly: "weekly",
  yearly: "monthly",
};

/** A deterministic reference reducer, not an LLM. Each parent consumes only its direct children.
 * Month-edge weeks are clipped to the parent window, so days never leak across months/years. */
export function rollup(
  workspace: Workspace,
  period: Period,
  start: string,
  end: string,
  allowed: (change: Change) => boolean = () => true,
): { root: BriefNode; nodes: BriefNode[]; changes: Change[] } {
  const nodes: BriefNode[] = [];
  const allChanges = workspace.dailyBriefs
    .flatMap((b) => b.changes)
    .filter(allowed);
  const build = (grain: Period, a: string, b: string): BriefNode => {
    if (grain === "daily") {
      const daily = workspace.dailyBriefs.find((d) => d.date === a);
      const items = (daily?.changes ?? []).filter(allowed);
      const node: BriefNode = {
        id: `daily:${a}`,
        period: grain,
        start: a,
        end: b,
        childIds: [],
        dailyIds: items.length && daily ? [daily.id] : [],
        evidenceIds: unique(items.flatMap((c) => c.evidenceIds)),
        changeIds: unique(items.map((c) => c.id)),
        observedDates: items.length ? [a] : [],
        revision: revision([
          items,
          workspace.evidence.filter((e) =>
            items.some((c) => c.evidenceIds.includes(e.id)),
          ),
        ]),
      };
      if (items.length) nodes.push(node);
      return node;
    }
    const children: BriefNode[] = [];
    const childGrain = levelBelow[grain];
    for (let cursor = a; cursor <= b;) {
      const window = bounds(cursor, childGrain);
      const childEnd = window.end > b ? b : window.end;
      const child = build(childGrain, cursor, childEnd);
      if (child.changeIds.length) children.push(child);
      cursor = addDays(childEnd, 1);
    }
    const node: BriefNode = {
      id: `${grain}:${a}:${b}`,
      period: grain,
      start: a,
      end: b,
      childIds: children.map((c) => c.id),
      dailyIds: unique(children.flatMap((c) => c.dailyIds)),
      evidenceIds: unique(children.flatMap((c) => c.evidenceIds)),
      changeIds: unique(children.flatMap((c) => c.changeIds)),
      observedDates: unique(children.flatMap((c) => c.observedDates)).sort(),
      revision: revision(children.map((c) => [c.id, c.revision])),
    };
    if (node.changeIds.length) nodes.push(node);
    return node;
  };
  const root = build(period, start, end);
  return {
    root,
    nodes,
    changes: allChanges.filter((c) => root.changeIds.includes(c.id)),
  };
}

/** Guard cycles and retain individual attribution. Hierarchy is scope, never personal credit. */
export function descendants(people: Person[], managerId: string): string[] {
  const seen = new Set<string>([managerId]);
  const queue = [managerId];
  while (queue.length) {
    const current = queue.shift();
    for (const p of people.filter((p) => p.reportsTo === current))
      if (!seen.has(p.id)) {
        seen.add(p.id);
        queue.push(p.id);
      }
  }
  return [...seen].filter((id) => id !== managerId);
}

/** The change filter a copy's subject stands for. Sealing and lookup must use the same scope. */
export function subjectFilter(
  workspace: Workspace,
  subject: BriefCopy["subject"],
): (change: Change) => boolean {
  if (subject.kind === "projects") {
    if (!subject.id.startsWith("group:")) return (c) => c.projectId === subject.id;
    const scope = subject.id.slice("group:".length);
    return (c) =>
      workspace.projects.some(
        (p) => p.id === c.projectId && (scope === "all" || p.groupId === scope),
      );
  }
  if (subject.id.startsWith("group:")) {
    const scope = subject.id.slice("group:".length);
    const members = workspace.people
      .filter((p) => scope === "all" || p.groupId === scope)
      .map((p) => p.id);
    return (c) => c.contributions.some((x) => members.includes(x.personId));
  }
  const members = [subject.id, ...descendants(workspace.people, subject.id)];
  return (c) => c.contributions.some((x) => members.includes(x.personId));
}

export function normalizeQuery(
  input: Record<string, string | string[] | undefined>,
  workspace: Workspace,
  selfId = "zhiyuan",
): Query {
  const values = Object.fromEntries(
    Object.entries(input).map(([key, value]) => [
      key,
      Array.isArray(value) ? value[0] : value,
    ]),
  );
  const parsed = QuerySchema.safeParse({ date: workspace.asOf, ...values });
  const query = parsed.success
    ? parsed.data
    : QuerySchema.parse({ date: workspace.asOf });
  if (
    query.scope !== "all" &&
    !workspace.groups.some((g) => g.id === query.scope)
  )
    query.scope = "all";
  if (query.view === "self") {
    query.id = selfId;
    query.scope = "all";
  } else if (query.view === "projects") {
    const project = workspace.projects.find((p) => p.id === query.id);
    if (!project || (query.scope !== "all" && project.groupId !== query.scope))
      query.id = "all";
    if (
      !["overview", "progress", "context"].includes(query.tab) ||
      (query.id === "all" && query.tab === "context")
    )
      query.tab = "overview";
  } else {
    const person = workspace.people.find((p) => p.id === query.id);
    if (!person || (query.scope !== "all" && person.groupId !== query.scope))
      query.id = "all";
    if (!["overview", "contributions", "progress"].includes(query.tab))
      query.tab = "overview";
  }
  if (query.view === "self" && !["overview", "suggestions"].includes(query.tab))
    query.tab = "overview";
  return query;
}

export function buildDashboard(workspace: Workspace, query: Query): Dashboard {
  const range = bounds(query.date, query.period);
  const end = range.end < workspace.asOf ? range.end : workspace.asOf;
  const selectedPerson =
    query.view !== "projects"
      ? workspace.people.find((p) => p.id === query.id)
      : undefined;
  const selectedProject =
    query.view === "projects"
      ? workspace.projects.find((p) => p.id === query.id)
      : undefined;
  const managedPersonIds = selectedPerson
    ? descendants(workspace.people, selectedPerson.id)
    : [];
  const memberIds = selectedPerson
    ? [selectedPerson.id, ...managedPersonIds]
    : workspace.people
        .filter((p) => query.scope === "all" || p.groupId === query.scope)
        .map((p) => p.id);
  const allowed = (c: Change): boolean => {
    if (query.view !== "projects")
      return c.contributions.some((x) => memberIds.includes(x.personId));
    if (selectedProject) return c.projectId === selectedProject.id;
    return workspace.projects.some(
      (p) =>
        p.id === c.projectId &&
        (query.scope === "all" || p.groupId === query.scope),
    );
  };
  // Empty future windows are intentional. They do not reuse today's work under a future date.
  const history = workspace.dailyBriefs
    .filter((b) => b.date <= end)
    .flatMap((b) => b.changes)
    .filter(allowed);
  const { root, nodes, changes } = rollup(
    workspace,
    query.period,
    range.start,
    range.end,
    (c) => c.date <= end && allowed(c),
  );
  const currentChanges = latestPerWork(changes);
  const projects = workspace.projects.filter((p) =>
    query.view === "projects"
      ? (!selectedProject || p.id === selectedProject.id) &&
        (query.scope === "all" || p.groupId === query.scope)
      : history.some((c) => c.projectId === p.id),
  );
  const visibleProjects = projects.map((project) => {
    const inWindow = currentChanges.filter((c) => c.projectId === project.id);
    const prior = latestPerWork(
      history.filter((c) => c.projectId === project.id),
    );
    // A project can have concurrent streams. Prefer the explicit support-bearing update
    // on the same date; preserve every other stream in the detail view.
    const candidates = inWindow.length ? inWindow : prior;
    const latestDate = candidates[0]?.date;
    const lead =
      candidates.find((c) => c.date === latestDate && c.support) ??
      candidates[0];
    return {
      project,
      changes: inWindow,
      latest: lead,
      current: inWindow.length > 0,
    };
  });
  // Public demo DTO: approved summaries only; no original prompts/messages are ever loaded.
  const scenarioActive =
    query.scenario !== "normal" &&
    !!selectedProject &&
    selectedProject.id === "praetorian" &&
    range.start <= workspace.asOf &&
    end >= workspace.asOf;
  const publicEvidence = workspace.evidence
    .filter((e) => e.date <= end && projects.some((p) => p.id === e.projectId))
    .map((e) =>
      scenarioActive && query.scenario === "delayed" && e.id === "pr-297"
        ? {
            ...e,
            date: "2026-09-08",
            summary:
              "PR #297 was open in the last available September 8 snapshot.",
            limitation:
              "The current PR state is unknown because the refresh is delayed.",
          }
        : e,
    );
  if (scenarioActive && query.scenario === "conflict")
    publicEvidence.push({
      id: "conflict-report",
      projectId: "praetorian",
      date: workspace.asOf,
      title: "Agent-reported completion",
      source: "Agent sessions",
      basis: "reported",
      summary: "Reported the retry fix as complete after local changes.",
      limitation:
        "This report is not reconciled with the captured test result. No later test was collected.",
      items: [],
      restricted: false,
    });
  const decorate = (change: Change): Change =>
    scenarioActive && query.scenario === "delayed"
      ? {
          ...change,
          facts: change.facts?.map((f) =>
            f.evidenceId === "pr-297"
              ? {
                  ...f,
                  label: "Pull request: Last known open",
                  context: "#297 · As of Sep 8",
                }
              : f,
          ),
        }
      : change;
  const subject = subjectKey(query);
  const copies = (workspace.briefCopies ?? []).filter(
    (c) => c.subject.kind === subject.kind && c.subject.id === subject.id,
  );
  // People views carry only the plans the person or their reports are attached to,
  // so a colleague's unrelated project plan never rides along with a person brief.
  const scopedPlans = plansAt(workspace.deliveryPlans, end).filter((p) =>
    query.view === "projects"
      ? projects.some((project) => project.id === p.projectId)
      : p.tasks.some((t) => t.ownerId && memberIds.includes(t.ownerId)) ||
        workspace.projects.some(
          (project) =>
            project.id === p.projectId &&
            project.ownerIds.some((id) => memberIds.includes(id)),
        ),
  );
  return {
    query,
    copy:
      query.scenario === "normal"
        ? copies.find(
            (c) =>
              c.period === query.period &&
              c.start === range.start &&
              c.end === range.end &&
              c.sourceRevision === root.revision &&
              c.childIds.length === root.childIds.length &&
              c.childIds.every((id) => root.childIds.includes(id)) &&
              c.evidenceIds.every((id) => root.evidenceIds.includes(id)),
          )
        : undefined,
    digest: buildDigest({
      period: query.period,
      range,
      end,
      asOf: workspace.asOf,
      root,
      changes,
      evidence: publicEvidence,
      plans: workspace.deliveryPlans,
      projectIds: projects.map((p) => p.id),
      copies,
      subject,
    }),
    suggestions:
      query.view === "self"
        ? (workspace.suggestions ?? []).filter(
            (s) =>
              s.personId === query.id &&
              currentChanges.some((c) => c.workId === s.workId),
          )
        : [],
    workspace: {
      groups: workspace.groups,
      people: workspace.people,
      projects: workspace.projects,
      evidence: publicEvidence,
      asOf: workspace.asOf,
      deliveryPlans: scopedPlans,
      sourceStates: workspace.sourceStates?.filter(
        (s) =>
          s.asOf <= end &&
          s.projectIds.some((id) => projects.some((p) => p.id === id)),
      ),
    },
    selectedPerson,
    selectedProject,
    managedPersonIds,
    visibleProjects: visibleProjects.map((s) => ({
      ...s,
      latest: s.latest ? decorate(s.latest) : undefined,
      changes: s.changes.map(decorate),
    })),
    currentChanges: currentChanges.map(decorate),
    periodChanges: changes,
    root,
    lineage: nodes,
    range,
    ...(scenarioActive && query.scenario === "delayed"
      ? {
          notice: {
            text: "GitHub refresh delayed. Last snapshot: Sep 8.",
            evidenceId: "pr-297",
          },
        }
      : {}),
    ...(scenarioActive && query.scenario === "conflict"
      ? {
          conflict: {
            headline: "The latest result needs clarification.",
            observationIds: ["conflict-report", "run-184"],
            explanation:
              "No later test result was collected to reconcile these records.",
          },
        }
      : {}),
  };
}

export function validateReferences(workspace: Workspace): string[] {
  const errors: string[] = validateDelivery(workspace);
  for (const [name, ids] of Object.entries({
    evidence: workspace.evidence.map((e) => e.id),
    projects: workspace.projects.map((p) => p.id),
    people: workspace.people.map((p) => p.id),
    groups: workspace.groups.map((g) => g.id),
    dailyBriefs: workspace.dailyBriefs.map((b) => b.id),
    briefDates: workspace.dailyBriefs.map((b) => b.date),
  })) {
    if (new Set(ids).size !== ids.length) errors.push(`Duplicate ${name}`);
  }
  const evidenceIds = new Set(workspace.evidence.map((e) => e.id));
  const projectIds = new Set(workspace.projects.map((p) => p.id));
  const personIds = new Set(workspace.people.map((p) => p.id));
  const groupIds = new Set(workspace.groups.map((g) => g.id));
  for (const p of workspace.people) {
    if (!groupIds.has(p.groupId)) errors.push(`Unknown group: ${p.groupId}`);
    if (p.reportsTo && !personIds.has(p.reportsTo))
      errors.push(`Unknown manager: ${p.reportsTo}`);
    const seen = new Set([p.id]);
    let current = p.reportsTo;
    while (current) {
      if (seen.has(current)) {
        errors.push(`Reporting cycle: ${p.id}`);
        break;
      }
      seen.add(current);
      current = workspace.people.find((x) => x.id === current)?.reportsTo;
    }
  }
  for (const p of workspace.projects) {
    if (!groupIds.has(p.groupId)) errors.push(`Unknown group: ${p.groupId}`);
    if (p.ownerIds.some((id) => !personIds.has(id)))
      errors.push(`Unknown project owner: ${p.id}`);
    if (
      new Set(p.milestone.criteria.map((c) => c.id)).size !==
      p.milestone.criteria.length
    )
      errors.push(`Duplicate criteria: ${p.id}`);
  }
  for (const e of workspace.evidence) {
    const p = workspace.projects.find((p) => p.id === e.projectId);
    if (!p) errors.push(`Unknown evidence project: ${e.id}`);
    if (e.date > workspace.asOf) errors.push(`Future evidence: ${e.id}`);
    if (
      Object.keys(e.criteria ?? {}).some(
        (id) => !p?.milestone.criteria.some((c) => c.id === id),
      )
    )
      errors.push(`Unknown evidence criterion: ${e.id}`);
  }
  for (const s of workspace.sourceStates ?? []) {
    if (s.projectIds.some((id) => !projectIds.has(id)))
      errors.push(`Unknown source project: ${s.source}`);
    if (s.asOf > workspace.asOf)
      errors.push(`Future source state: ${s.source}`);
  }
  for (const s of workspace.suggestions ?? [])
    if (
      !personIds.has(s.personId) ||
      !workspace.dailyBriefs.some((b) =>
        b.changes.some(
          (c) =>
            c.workId === s.workId &&
            c.contributions.some((p) => p.personId === s.personId),
        ),
      )
    )
      errors.push(`Invalid suggestion scope: ${s.id}`);
  const changeIds = new Set<string>();
  for (const b of workspace.dailyBriefs) {
    if (b.date > workspace.asOf) errors.push(`Future daily brief: ${b.id}`);
    for (const c of b.changes) {
      if (changeIds.has(c.id)) errors.push(`Duplicate change: ${c.id}`);
      changeIds.add(c.id);
      if (!projectIds.has(c.projectId))
        errors.push(`Unknown project: ${c.projectId}`);
      for (const id of c.evidenceIds) {
        const e = workspace.evidence.find((e) => e.id === id);
        if (!evidenceIds.has(id)) errors.push(`Missing evidence: ${id}`);
        if (e && (e.date > c.date || e.projectId !== c.projectId))
          errors.push(`Invalid evidence scope: ${id}`);
      }
      for (const contribution of c.contributions)
        if (!personIds.has(contribution.personId))
          errors.push(`Unknown person: ${contribution.personId}`);
      for (const context of [
        c.nextStep,
        c.support,
        ...(c.facts ?? []),
        ...(c.checkpoints ?? []),
        ...(c.noteEvidenceId ? [{ evidenceId: c.noteEvidenceId }] : []),
      ])
        if (context?.evidenceId && !c.evidenceIds.includes(context.evidenceId))
          errors.push(`Context evidence missing: ${context.evidenceId}`);
    }
  }
  return errors;
}
