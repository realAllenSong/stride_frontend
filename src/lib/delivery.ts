import type { DeliveryPlan, Workspace } from "./contracts";

/** Pick recorded state at a date boundary; future targets are plans, not future results. */
export function plansAt(
  plans: DeliveryPlan[] = [],
  end: string,
): DeliveryPlan[] {
  const latest = new Map<string, DeliveryPlan>();
  for (const plan of plans) {
    if (
      plan.asOf <= end &&
      (!latest.has(plan.projectId) ||
        latest.get(plan.projectId)!.asOf < plan.asOf)
    )
      latest.set(plan.projectId, plan);
  }
  return [...latest.values()];
}

export function currentMilestone(plan: DeliveryPlan) {
  return (
    plan.milestones.find((m) => m.state === "active") ??
    plan.milestones.find((m) => m.state === "planned") ??
    plan.milestones.at(-1)!
  );
}

export const taskStatus = {
  planned: "Planned",
  doing: "In progress",
  review: "In review",
  done: "Done",
} as const;

export function validateDelivery(workspace: Workspace): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  const dates = new Set<string>();
  const evidence = new Map(workspace.evidence.map((e) => [e.id, e]));
  for (const plan of workspace.deliveryPlans ?? []) {
    const fail = (message: string) =>
      errors.push(`Delivery ${plan.id}: ${message}`);
    if (seen.has(plan.id)) fail("duplicate plan ID");
    seen.add(plan.id);
    const dateKey = `${plan.projectId}:${plan.asOf}`;
    if (dates.has(dateKey)) fail("ambiguous snapshot date");
    dates.add(dateKey);
    if (!workspace.projects.some((p) => p.id === plan.projectId))
      fail("unknown project");
    if (plan.asOf > workspace.asOf) fail("future snapshot");
    const ids = [...plan.milestones, ...plan.tasks, ...plan.resources].map(
      (x) => x.id,
    );
    if (new Set(ids).size !== ids.length) fail("duplicate node ID");
    const checkEvidence = (references: string[]) => {
      for (const id of references) {
        const record = evidence.get(id);
        if (
          !record ||
          record.projectId !== plan.projectId ||
          record.date > plan.asOf
        )
          fail(`invalid evidence ${id}`);
      }
    };
    if (plan.milestones.filter((m) => m.state === "active").length > 1)
      fail("multiple active milestones");
    let incompleteSeen = false;
    for (const m of plan.milestones) {
      if (m.state === "complete" && incompleteSeen)
        fail("completed milestone after unfinished gate");
      if (m.state !== "complete") incompleteSeen = true;
      if (m.state === "complete" && m.criteria.some((c) => c.state !== "met"))
        fail("completed milestone with unmet criteria");
      for (const c of m.criteria) {
        checkEvidence(c.evidenceIds);
        if (c.state !== "unknown" && !c.evidenceIds.length)
          fail("criterion state without evidence");
      }
    }
    const tasks = new Map(plan.tasks.map((t) => [t.id, t]));
    for (const t of plan.tasks) {
      if (!plan.milestones.some((m) => m.id === t.milestoneId))
        fail("unknown task milestone");
      if (t.ownerId && !workspace.people.some((p) => p.id === t.ownerId))
        fail("unknown task owner");
      if (t.status !== "planned" && !t.evidenceIds.length)
        fail("task state without evidence");
      checkEvidence(t.evidenceIds);
      if (t.dependsOn.some((id) => !tasks.has(id))) fail("unknown dependency");
    }
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const visit = (id: string): boolean => {
      if (visiting.has(id)) return true;
      if (visited.has(id)) return false;
      visiting.add(id);
      if (tasks.get(id)?.dependsOn.some(visit)) return true;
      visiting.delete(id);
      visited.add(id);
      return false;
    };
    if (plan.tasks.some((t) => visit(t.id))) fail("dependency cycle");
    for (const resource of plan.resources) {
      checkEvidence(resource.evidenceIds);
      if (resource.taskIds.some((id) => !tasks.has(id)))
        fail("unknown resource task");
    }
    for (const related of plan.relatedProjects) {
      if (
        related.projectId === plan.projectId ||
        !workspace.projects.some((p) => p.id === related.projectId)
      )
        fail("invalid related project");
    }
  }
  return errors;
}
