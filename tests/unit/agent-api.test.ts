import { describe, expect, it } from "vitest";
import { demoWorkspace } from "@/data/demo";
import { authorizeWorkspace } from "@/lib/access";
import {
  evidenceRecord,
  listPeople,
  listProjects,
  NotFound,
  openApiDocument,
  periodBrief,
  personDetail,
  projectDetail,
  projectGraph,
  workspaceGraph,
  BriefQuery,
} from "@/lib/agent-api";

describe("Agent API projections", () => {
  it("lists projects with their current gate as of a date and never a later plan", () => {
    const now = listProjects(demoWorkspace, {});
    expect(now.projects.find((p) => p.id === "praetorian")!.plan!.currentMilestone.id).toBe("recovery");
    expect(now.projects.find((p) => p.id === "research")!.plan).toBeUndefined();
    const earlier = listProjects(demoWorkspace, { date: "2026-09-05" });
    const plan = earlier.projects.find((p) => p.id === "praetorian")!.plan!;
    expect(plan.asOf).toBe("2026-09-04");
    expect(plan.currentMilestone.id).toBe("baseline");
    expect(earlier.projects.find((p) => p.id === "praetorian")!.latest!.date).toBe("2026-09-04");
    expect(listProjects(demoWorkspace, { scope: "risk" }).projects.map((p) => p.id)).toEqual(["risk"]);
  });
  it("builds a project graph whose edges only reference emitted nodes", () => {
    const graph = projectGraph(demoWorkspace, "praetorian", {});
    const ids = new Set(graph.nodes.map((n) => n.id));
    expect(graph.edges.every((e) => ids.has(e.from) && ids.has(e.to))).toBe(true);
    expect(graph.nodes.some((n) => n.kind === "task" && n.id === "task:PRT-102")).toBe(true);
    expect(graph.edges.some((e) => e.kind === "depends-on")).toBe(true);
    expect(graph.edges.some((e) => e.kind === "assigned-to" && e.to === "person:zhiyuan")).toBe(true);
    expect(graph.edges.some((e) => e.kind === "related-to")).toBe(true);
    expect(() => projectGraph(demoWorkspace, "nope", {})).toThrow(NotFound);
  });
  it("builds a workspace graph with reporting lines, ownership and contribution edges", () => {
    const graph = workspaceGraph(demoWorkspace, {});
    const kinds = new Set(graph.edges.map((e) => e.kind));
    for (const k of ["in-group", "owns", "reports-to", "has-milestone", "contributed-to", "related-to"])
      expect(kinds.has(k as never), k).toBe(true);
    const ids = new Set(graph.nodes.map((n) => n.id));
    expect(graph.edges.every((e) => ids.has(e.from) && ids.has(e.to))).toBe(true);
    expect(graph.nodes.filter((n) => n.kind === "evidence")).toEqual([]);
  });
  it("describes people by record coverage, not by score", () => {
    const people = listPeople(demoWorkspace, { period: "weekly" });
    const zhiyuan = people.people.find((p) => p.id === "zhiyuan")!;
    expect(zhiyuan.updates).toBe(4);
    expect(zhiyuan.recordedDays).toBe(3);
    expect(zhiyuan.projectIds.sort()).toEqual(["praetorian", "stride"]);
    expect(people.people.find((p) => p.id === "ethan")!.updates).toBe(0);
    expect(JSON.stringify(people)).not.toMatch(/score|rank|productiv/i);
    const detail = personDetail(demoWorkspace, "zhiyuan", { period: "weekly" });
    expect(detail.headline).toBe("Retry handling moved from design to a local test run.");
    expect(detail.tasksOwned.map((t) => t.projectId)).toContain("stride");
    expect(detail.person.reportsTo?.id).toBe("elena");
    expect(personDetail(demoWorkspace, "elena", { period: "weekly" }).teamChanges.length).toBeGreaterThan(0);
  });
  it("returns a project detail as of a date with only evidence up to that date", () => {
    const detail = projectDetail(demoWorkspace, "praetorian", { date: "2026-09-05" });
    expect(detail.plan!.asOf).toBe("2026-09-04");
    expect(detail.evidence.every((e) => e.date <= "2026-09-05")).toBe(true);
    expect(detail.streams.find((s) => s.workId === "retry-recovery")!.last.date).toBe("2026-09-04");
  });
  it("serves the same brief text the page shows, with digest and lineage", () => {
    const brief = periodBrief(demoWorkspace, BriefQuery.parse({ id: "praetorian", period: "monthly" }));
    expect(brief.headline).toBe("Retry recovery reached local validation.");
    expect(brief.copy?.period).toBe("monthly");
    expect(brief.digest.slots).toHaveLength(5);
    expect(brief.lineage.root.period).toBe("monthly");
    const derived = periodBrief(demoWorkspace, BriefQuery.parse({ id: "verity", period: "weekly" }));
    expect(derived.generated).toBe(false);
    expect(derived.digest.streams).toHaveLength(1);
  });
  it("returns evidence with its citations and hides future records", () => {
    const record = evidenceRecord(demoWorkspace, "run-184", {});
    expect(record.usedBy.map((c) => c.changeId)).toContain("retry-sep9");
    expect(() => evidenceRecord(demoWorkspace, "run-184", { date: "2026-09-08" })).toThrow(NotFound);
  });
  it("respects an access-scoped workspace end to end", () => {
    const scoped = authorizeWorkspace(demoWorkspace, {
      subject: "reviewer",
      personId: "zhiyuan",
      groupIds: [],
      projectIds: ["praetorian"],
    });
    expect(listProjects(scoped, {}).projects.map((p) => p.id)).toEqual(["praetorian"]);
    expect(() => projectDetail(scoped, "verity", {})).toThrow(NotFound);
    const graph = workspaceGraph(scoped, {});
    expect(graph.nodes.filter((n) => n.kind === "project").map((n) => n.id)).toEqual(["project:praetorian"]);
    expect(graph.edges.some((e) => e.kind === "related-to")).toBe(false);
    expect(JSON.stringify(periodBrief(scoped, BriefQuery.parse({ view: "people", id: "zhiyuan" })))).not.toContain("verity");
  });
  it("publishes an OpenAPI 3.1 document covering every v1 route", () => {
    const doc = openApiDocument("http://127.0.0.1:3100");
    expect(doc.openapi).toBe("3.1.0");
    for (const path of [
      "/api/v1/workspace",
      "/api/v1/projects",
      "/api/v1/projects/{id}",
      "/api/v1/projects/{id}/graph",
      "/api/v1/graph",
      "/api/v1/people",
      "/api/v1/people/{id}",
      "/api/v1/briefs",
      "/api/v1/evidence/{id}",
    ])
      expect(Object.keys(doc.paths)).toContain(path);
    expect(JSON.stringify(doc)).not.toMatch(/"(post|put|delete|patch)"/);
  });
});
