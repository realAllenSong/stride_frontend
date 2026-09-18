import { describe, expect, it } from "vitest";
import { demoWorkspace } from "@/data/demo";
import { DeliveryPlanSchema, QuerySchema, WorkspaceSchema } from "@/lib/contracts";
import { buildDashboard, normalizeQuery, validateReferences } from "@/lib/briefs";
import { authorizeWorkspace } from "@/lib/access";
import { currentMilestone, plansAt, validateDelivery } from "@/lib/delivery";

describe("Delivery plans are not activity briefs", () => {
  it("validates the complete plans and preserves explicit milestone order", () => {
    expect(WorkspaceSchema.safeParse(demoWorkspace).success).toBe(true);
    expect(validateReferences(demoWorkspace)).toEqual([]);
    const plan = plansAt(demoWorkspace.deliveryPlans, "2026-09-09")[0];
    expect(plan.milestones.map((m) => m.id)).toEqual(["baseline", "recovery", "release", "pilot"]);
    expect(currentMilestone(plan).id).toBe("recovery");
    expect(plan.tasks.filter((t) => t.status === "done")).toHaveLength(2);
  });
  it("returns at most one recorded plan per project and no future results", () => {
    const older = buildDashboard(demoWorkspace, QuerySchema.parse({ id: "praetorian", period: "daily", date: "2026-09-08" }));
    expect(older.workspace.deliveryPlans).toHaveLength(1);
    const plan = older.workspace.deliveryPlans![0];
    expect(plan.asOf).toBe("2026-09-08");
    expect(JSON.stringify(plan)).not.toContain("run-184");
    expect(JSON.stringify(plan)).not.toContain("PR #297 is open");
    expect(plan.tasks.filter((t) => t.status === "done")).toHaveLength(1);
    expect(plansAt(demoWorkspace.deliveryPlans, "2026-09-01")).toEqual([]);
    expect(plansAt([...demoWorkspace.deliveryPlans!].reverse(), "2026-09-09")[0].asOf).toBe("2026-09-08");
  });
  it("retains last-recorded plans for a future window without inventing completion", () => {
    const future = buildDashboard(demoWorkspace, QuerySchema.parse({ id: "praetorian", period: "daily", date: "2026-10-01" }));
    expect(future.currentChanges).toEqual([]);
    expect(future.workspace.deliveryPlans![0].asOf).toBe("2026-09-09");
    expect(currentMilestone(future.workspace.deliveryPlans![0]).state).toBe("active");
  });
  it("does not manufacture a plan for notes-only work and scopes people views to attached plans", () => {
    expect(buildDashboard(demoWorkspace, QuerySchema.parse({ id: "research" })).workspace.deliveryPlans).toEqual([]);
    // A person brief carries only plans that person (or their reports) own tasks or projects in.
    const zhiyuan = buildDashboard(demoWorkspace, QuerySchema.parse({ view: "people", id: "zhiyuan" }));
    expect(zhiyuan.workspace.deliveryPlans!.map((p) => p.projectId).sort()).toEqual(["praetorian", "stride"]);
    const priya = buildDashboard(demoWorkspace, QuerySchema.parse({ view: "people", id: "priya" }));
    expect(priya.workspace.deliveryPlans).toEqual([]);
    expect(normalizeQuery({ view: "people", id: "zhiyuan", tab: "context" }, demoWorkspace).tab).toBe("overview");
    expect(normalizeQuery({ id: "all", tab: "context" }, demoWorkspace).tab).toBe("overview");
  });
  it("rejects unsupported states, unknown fields, duplicate nodes and cyclic dependencies", () => {
    const copy = structuredClone(demoWorkspace);
    const plan = copy.deliveryPlans![2];
    expect(DeliveryPlanSchema.safeParse({ ...plan, rawPrompt: "private" }).success).toBe(false);
    plan.tasks[0].dependsOn = [plan.tasks[1].id];
    plan.milestones[1].state = "complete";
    plan.tasks.push({ ...plan.tasks[1] });
    const errors = validateDelivery(copy).join("\n");
    expect(errors).toContain("dependency cycle");
    expect(errors).toContain("duplicate node ID");
    expect(errors).toContain("completed milestone with unmet criteria");
  });
  it("rejects cross-project/future proof and evidence-free state claims", () => {
    const copy = structuredClone(demoWorkspace);
    copy.deliveryPlans![0].tasks[0].evidenceIds = ["run-184", "stride-note"];
    copy.deliveryPlans![2].milestones[0].criteria[0].evidenceIds = [];
    copy.deliveryPlans![2].tasks[0].evidenceIds = [];
    const errors = validateDelivery(copy).join("\n");
    expect(errors).toContain("invalid evidence run-184");
    expect(errors).toContain("invalid evidence stride-note");
    expect(errors).toContain("criterion state without evidence");
    expect(errors).toContain("task state without evidence");
  });
  it("prunes graph links and plan content before the server serializes an access-scoped workspace", () => {
    const scoped = authorizeWorkspace(demoWorkspace, { subject: "reviewer", personId: "zhiyuan", groupIds: [], projectIds: ["praetorian"] });
    expect(scoped.deliveryPlans!.every((p) => p.projectId === "praetorian")).toBe(true);
    expect(scoped.deliveryPlans!.flatMap((p) => p.relatedProjects)).toEqual([]);
    const data = buildDashboard(scoped, normalizeQuery({ id: "praetorian", tab: "context" }, scoped));
    expect(JSON.stringify(data)).not.toContain("Uses inspectable evidence normalization");
    expect(JSON.stringify(data)).not.toContain("pilot-scope");
    expect(data.workspace.people.map((p) => p.id)).toContain("marcus");
    expect(validateReferences(scoped)).toEqual([]);
  });
});
