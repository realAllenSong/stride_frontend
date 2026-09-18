import { describe, expect, it } from "vitest";
import { demoWorkspace } from "@/data/demo";
import {
  buildDashboard,
  descendants,
  latestPerWork,
  normalizeQuery,
  rollup,
  validateReferences,
} from "@/lib/briefs";
import { DailyBriefSchema, QuerySchema } from "@/lib/contracts";
import { bounds, shiftPeriod, validDate } from "@/lib/dates";
const query = (overrides = {}) => QuerySchema.parse(overrides);

describe("Calendar windows", () => {
  it("rejects rollover and malformed dates", () => {
    expect(validDate("2026-02-30")).toBe(false);
    expect(validDate("2028-02-29")).toBe(true);
    expect(validDate("2026-9-9")).toBe(false);
  });
  it("starts weeks on Monday", () =>
    expect(bounds("2026-09-09", "weekly")).toEqual({
      start: "2026-09-07",
      end: "2026-09-13",
    }));
  it("clamps month and leap-year navigation", () => {
    expect(shiftPeriod("2026-01-31", "monthly", 1)).toBe("2026-02-28");
    expect(shiftPeriod("2028-02-29", "yearly", 1)).toBe("2029-02-28");
  });
});
describe("Brief provenance and hierarchy", () => {
  it("has valid project, person and evidence references", () =>
    expect(validateReferences(demoWorkspace)).toEqual([]));
  it("rejects unsupported fields and overly long model copy", () => {
    expect(
      DailyBriefSchema.safeParse({
        ...demoWorkspace.dailyBriefs[0],
        html: "<div/>",
      }).success,
    ).toBe(false);
    expect(
      DailyBriefSchema.safeParse({
        ...demoWorkspace.dailyBriefs[0],
        headline: "x".repeat(121),
      }).success,
    ).toBe(false);
  });
  it("rejects changes outside their daily brief date", () =>
    expect(
      DailyBriefSchema.safeParse({
        ...demoWorkspace.dailyBriefs[0],
        date: "2026-09-01",
      }).success,
    ).toBe(false));
  it("builds yearly from months, months from weeks, weeks from days", () => {
    const result = rollup(demoWorkspace, "yearly", "2026-01-01", "2026-12-31");
    const levels = { yearly: "monthly", monthly: "weekly", weekly: "daily" };
    for (const node of result.nodes)
      for (const id of node.childIds) {
        const child = result.nodes.find((c) => c.id === id)!;
        expect(child.period).toBe(levels[node.period as keyof typeof levels]);
        expect(child.start >= node.start && child.end <= node.end).toBe(true);
      }
    expect(new Set(result.root.evidenceIds).size).toBe(
      result.root.evidenceIds.length,
    );
  });
  it("does not leak August 31 into a September month-edge week", () => {
    const result = rollup(demoWorkspace, "monthly", "2026-09-01", "2026-09-30");
    expect(result.root.dailyIds).not.toContain("daily-2026-08-31");
    expect(result.root.evidenceIds).not.toContain("investigation-aug");
    expect(result.nodes.find((n) => n.period === "weekly")?.start).toBe(
      "2026-09-01",
    );
  });
  it("groups repeated work mentions without multiplying outcomes", () => {
    const result = rollup(demoWorkspace, "weekly", "2026-09-07", "2026-09-13");
    expect(
      result.changes.filter((c) => c.workId === "retry-recovery"),
    ).toHaveLength(3);
    expect(
      latestPerWork(result.changes).filter(
        (c) => c.workId === "retry-recovery",
      ),
    ).toHaveLength(1);
  });
  it("keeps notes reported through all rollups", () => {
    const result = buildDashboard(demoWorkspace, query({ period: "yearly" }));
    expect(
      result.currentChanges.find((c) => c.id === "stride-link")?.basis,
    ).toBe("reported");
    expect(
      result.currentChanges.find((c) => c.id === "retry-sep9")?.basis,
    ).toBe("captured");
  });
});
describe("Historical and organizational scope", () => {
  it("never sends future evidence into a historical view", () => {
    const result = buildDashboard(
      demoWorkspace,
      query({ period: "daily", date: "2026-09-04" }),
    );
    expect(result.workspace.evidence.every((e) => e.date <= "2026-09-04")).toBe(
      true,
    );
    expect(result.currentChanges.some((c) => c.id === "retry-sep9")).toBe(
      false,
    );
  });
  it("does not infer zero work from missing records", () => {
    const result = buildDashboard(
      demoWorkspace,
      query({ period: "daily", id: "risk" }),
    );
    expect(result.currentChanges).toEqual([]);
    expect(result.visibleProjects[0].latest?.date).toBe("2026-09-04");
    expect(result.visibleProjects[0].current).toBe(false);
  });
  it("shows future periods as empty and last-known history is dated", () => {
    const result = buildDashboard(
      demoWorkspace,
      query({ period: "daily", date: "2026-10-04" }),
    );
    expect(result.root.evidenceIds).toEqual([]);
    expect(result.currentChanges).toEqual([]);
  });
  it("filters a group and prevents selection outside it", () => {
    const q = normalizeQuery(
      { scope: "risk", id: "praetorian" },
      demoWorkspace,
    );
    expect(q.id).toBe("all");
    expect(
      buildDashboard(demoWorkspace, q).visibleProjects.map((p) => p.project.id),
    ).toEqual(["risk"]);
  });
  it("manager scope includes own and team contributions without changing attribution", () => {
    const result = buildDashboard(
      demoWorkspace,
      query({ view: "people", id: "elena" }),
    );
    expect(result.currentChanges.some((c) => c.id === "pilot-criteria")).toBe(
      true,
    );
    const retry = result.currentChanges.find((c) => c.id === "retry-sep9")!;
    expect(retry.contributions.map((c) => c.personId)).toEqual([
      "zhiyuan",
      "marcus",
    ]);
    expect(
      result.currentChanges.filter((c) => c.id === "retry-sep9"),
    ).toHaveLength(1);
  });
  it("handles cyclic reporting structures without an infinite loop", () => {
    const people = demoWorkspace.people.map((p) =>
      p.id === "elena" ? { ...p, reportsTo: "zhiyuan" } : p,
    );
    expect(descendants(people, "elena")).not.toContain("elena");
    expect(descendants(people, "elena")).toHaveLength(5);
  });
  it("does not require GitHub or Jira for a notes-only update", () => {
    const result = buildDashboard(
      demoWorkspace,
      query({ id: "research", period: "daily" }),
    );
    expect(result.root.evidenceIds).toEqual(["maya-note"]);
  });
  it("restricted evidence carries approved summaries, never raw sessions", () => {
    const result = buildDashboard(demoWorkspace, query());
    const record = result.workspace.evidence.find(
      (e) => e.id === "agent-retry",
    )!;
    expect(record.restricted).toBe(true);
    expect(record).not.toHaveProperty("raw");
    expect(record).not.toHaveProperty("prompt");
  });
  it("never serializes personal suggestions in a manager workspace", () => {
    const manager = buildDashboard(
      demoWorkspace,
      query({ view: "people", id: "elena" }),
    );
    expect(manager.suggestions).toEqual([]);
    expect(manager.workspace).not.toHaveProperty("suggestions");
    const self = buildDashboard(
      demoWorkspace,
      query({ view: "self", id: "zhiyuan" }),
    );
    expect(self.suggestions).toHaveLength(1);
  });
  it("accepts a generated period headline only with matching child lineage", () => {
    const monthly = buildDashboard(
      demoWorkspace,
      query({ id: "praetorian", period: "monthly" }),
    );
    expect(monthly.copy?.headline).toBe(
      "Retry recovery reached local validation.",
    );
    const mismatched = {
      ...demoWorkspace,
      briefCopies: demoWorkspace.briefCopies!.map((c) => ({
        ...c,
        childIds: ["unrelated-week"],
      })),
    };
    expect(
      buildDashboard(mismatched, query({ id: "praetorian", period: "monthly" }))
        .copy,
    ).toBeUndefined();
  });
  it("changing text does not require a new rendering template", () => {
    const alternate = {
      ...demoWorkspace,
      dailyBriefs: demoWorkspace.dailyBriefs.map((b) => ({
        ...b,
        changes: b.changes.map((c) =>
          c.id === "retry-sep9"
            ? {
                ...c,
                headline: "A new approved headline.",
                facts: [
                  {
                    label: "A replacement fact",
                    context: "Bounded source context",
                    kind: "result" as const,
                    evidenceId: "run-184",
                  },
                ],
              }
            : c,
        ),
      })),
    };
    const view = buildDashboard(
      alternate,
      query({ id: "praetorian", period: "daily" }),
    );
    expect(view.visibleProjects[0].latest?.headline).toBe(
      "A new approved headline.",
    );
    expect(view.visibleProjects[0].latest?.facts?.[0].label).toBe(
      "A replacement fact",
    );
  });
  it("rejects duplicate snapshots before rollup", () => {
    expect(
      validateReferences({
        ...demoWorkspace,
        dailyBriefs: [
          ...demoWorkspace.dailyBriefs,
          demoWorkspace.dailyBriefs[0],
        ],
      }),
    ).toContain("Duplicate briefDates");
  });
});
