import { describe, expect, it } from "vitest";
import { demoWorkspace } from "@/data/demo";
import { buildDashboard, subjectFilter } from "@/lib/briefs";
import { BriefCopySchema, QuerySchema } from "@/lib/contracts";
import { slotWindows } from "@/lib/digest";
const query = (overrides = {}) => QuerySchema.parse(overrides);

describe("Period templates have distinct, deterministic facts", () => {
  it("weekly digests have seven day slots clipped to the snapshot, monthly have weeks, yearly have twelve months", () => {
    const weekly = buildDashboard(demoWorkspace, query({ id: "praetorian", period: "weekly" }));
    expect(weekly.digest.unit).toBe("day");
    expect(weekly.digest.slots).toHaveLength(7);
    expect(weekly.digest.slots.map((s) => s.label)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    expect(weekly.digest.slots.filter((s) => s.future).map((s) => s.start)).toEqual([
      "2026-09-10",
      "2026-09-11",
      "2026-09-12",
      "2026-09-13",
    ]);
    const monthly = buildDashboard(demoWorkspace, query({ id: "praetorian", period: "monthly" }));
    expect(monthly.digest.unit).toBe("week");
    expect(monthly.digest.slots[0]).toMatchObject({ start: "2026-09-01", end: "2026-09-06", period: "weekly" });
    expect(monthly.digest.slots[1].headline).toBe("Bounded retries reached a local test run; two checks still fail.");
    const yearly = buildDashboard(demoWorkspace, query({ id: "praetorian", period: "yearly" }));
    expect(yearly.digest.slots).toHaveLength(12);
    expect(yearly.digest.slots[8].headline).toBe("Retry recovery reached local validation.");
    expect(yearly.digest.slots.filter((s) => s.changeIds.length).map((s) => s.label)).toEqual(["Jun", "Jul", "Aug", "Sep"]);
  });
  it("groups a work stream across the period and never counts repeated mentions as outcomes", () => {
    const yearly = buildDashboard(demoWorkspace, query({ id: "praetorian", period: "yearly" }));
    const retry = yearly.digest.streams.find((s) => s.workId === "retry-recovery")!;
    expect(retry.first.date).toBe("2026-06-24");
    expect(retry.last.date).toBe("2026-09-09");
    expect(retry.changeIds.length).toBeGreaterThan(5);
    expect(retry.contributorIds.sort()).toEqual(["ethan", "marcus", "zhiyuan"]);
    expect(yearly.digest.streams).toHaveLength(2);
  });
  it("reports milestone movement between recorded plan snapshots only", () => {
    const week = buildDashboard(demoWorkspace, query({ id: "praetorian", period: "weekly" }));
    expect(week.digest.milestoneMoves).toEqual([
      expect.objectContaining({ milestoneId: "baseline", from: "active", to: "complete" }),
      expect.objectContaining({ milestoneId: "recovery", from: "planned", to: "active" }),
    ]);
    const earlier = buildDashboard(demoWorkspace, query({ id: "praetorian", period: "weekly", date: "2026-08-24" }));
    expect(earlier.digest.milestoneMoves).toEqual([]);
    const year = buildDashboard(demoWorkspace, query({ period: "yearly" }));
    expect(year.digest.milestoneMoves.every((m) => m.to !== "planned")).toBe(true);
  });
  it("never puts future dates into slots or streams", () => {
    const future = buildDashboard(demoWorkspace, query({ period: "monthly", date: "2026-11-01" }));
    expect(future.digest.slots.every((s) => s.future && s.changeIds.length === 0)).toBe(true);
    expect(future.digest.streams).toEqual([]);
    expect(slotWindows("monthly", { start: "2026-09-01", end: "2026-09-30" }).at(-1)).toEqual({
      start: "2026-09-28",
      end: "2026-09-30",
      period: "weekly",
    });
  });
});

describe("Period copy is bounded per level", () => {
  it("rejects weekly fields on a monthly brief and unknown sections", () => {
    const monthly = demoWorkspace.briefCopies!.find((c) => c.period === "monthly")!;
    expect(BriefCopySchema.safeParse({ ...monthly, themes: [] }).success).toBe(false);
    expect(BriefCopySchema.safeParse({ ...monthly, html: "<b/>" }).success).toBe(false);
    const weekly = demoWorkspace.briefCopies!.find((c) => c.period === "weekly")!;
    expect(BriefCopySchema.safeParse({ ...weekly, arc: "x" }).success).toBe(false);
    expect(BriefCopySchema.safeParse({ ...weekly, themes: [] }).success).toBe(false);
    expect(BriefCopySchema.safeParse(weekly).success).toBe(true);
  });
  it("serves copy for every authored subject and level, sealed to the reducer revision", () => {
    for (const copy of demoWorkspace.briefCopies ?? []) {
      const view = copy.subject.kind === "projects" ? "projects" : "people";
      const id = copy.subject.id.startsWith("group:") ? "all" : copy.subject.id;
      const scope = copy.subject.id.startsWith("group:") ? copy.subject.id.slice(6) : "all";
      const view$ = buildDashboard(demoWorkspace, query({ view, id, scope, period: copy.period, date: copy.start }));
      expect(view$.copy?.headline, `${copy.period} ${copy.subject.id}`).toBe(copy.headline);
      expect(copy.evidenceIds.every((e) => view$.root.evidenceIds.includes(e))).toBe(true);
    }
  });
  it("scopes a person subject to that person and their reports", () => {
    const elena = subjectFilter(demoWorkspace, { kind: "people", id: "elena" });
    const priya = subjectFilter(demoWorkspace, { kind: "people", id: "priya" });
    const all = demoWorkspace.dailyBriefs.flatMap((b) => b.changes);
    expect(all.filter(elena).length).toBe(all.length);
    expect(all.filter(priya).every((c) => c.projectId === "risk")).toBe(true);
  });
  it("carries only attached delivery plans into a person brief", () => {
    const maya = buildDashboard(demoWorkspace, query({ view: "people", id: "maya" }));
    expect(maya.workspace.deliveryPlans!.map((p) => p.projectId)).toEqual(["verity"]);
  });
});
