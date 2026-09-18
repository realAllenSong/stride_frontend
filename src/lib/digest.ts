import { addDays, bounds, fromISO, shortDate, type Period } from "./dates";
import { plansAt } from "./delivery";
import type {
  BriefCopy,
  BriefNode,
  Change,
  DeliveryPlan,
  Evidence,
  MilestoneMove,
  PeriodDigest,
  PeriodSlot,
  WorkStream,
} from "./contracts";

const unique = <T>(values: T[]): T[] => [...new Set(values)];
const slotGrain: Record<Period, PeriodSlot["period"]> = {
  daily: "daily",
  weekly: "daily",
  monthly: "weekly",
  yearly: "monthly",
};
const unitOf: Record<Period, PeriodDigest["unit"]> = {
  daily: "day",
  weekly: "day",
  monthly: "week",
  yearly: "month",
};
const weekday = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  timeZone: "UTC",
});
const monthName = new Intl.DateTimeFormat("en-US", {
  month: "short",
  timeZone: "UTC",
});

export function slotLabel(
  grain: PeriodSlot["period"],
  start: string,
  end: string,
): string {
  if (grain === "daily") return weekday.format(fromISO(start));
  if (grain === "weekly")
    return start === end
      ? shortDate(start)
      : `${shortDate(start)} – ${shortDate(end)}`;
  return monthName.format(fromISO(start));
}

/** Windows of the child grain, clipped to the parent range exactly like the rollup does. */
export function slotWindows(
  period: Period,
  range: { start: string; end: string },
): { start: string; end: string; period: PeriodSlot["period"] }[] {
  const grain = slotGrain[period];
  if (period === "daily")
    return [{ start: range.start, end: range.end, period: "daily" }];
  const windows: { start: string; end: string; period: PeriodSlot["period"] }[] =
    [];
  for (let cursor = range.start; cursor <= range.end; ) {
    const window = bounds(cursor, grain);
    const end = window.end > range.end ? range.end : window.end;
    windows.push({ start: cursor, end, period: grain });
    cursor = addDays(end, 1);
  }
  return windows;
}

export function subjectKey(query: {
  view: string;
  id: string;
  scope: string;
}): { kind: "projects" | "people"; id: string } {
  return {
    kind: query.view === "projects" ? "projects" : "people",
    id: query.id === "all" ? `group:${query.scope}` : query.id,
  };
}

export function streamsOf(changes: Change[]): WorkStream[] {
  const groups = new Map<string, Change[]>();
  for (const change of [...changes].sort(
    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
  )) {
    const key = `${change.projectId}:${change.workId}`;
    groups.set(key, [...(groups.get(key) ?? []), change]);
  }
  return [...groups.values()]
    .map((items) => {
      const first = items[0];
      const last = items[items.length - 1];
      return {
        workId: last.workId,
        projectId: last.projectId,
        title: last.title,
        first: { date: first.date, title: first.title },
        last: {
          date: last.date,
          title: last.title,
          detail: last.detail,
          basis: last.basis,
        },
        changeIds: items.map((c) => c.id),
        evidenceIds: unique(items.flatMap((c) => c.evidenceIds)),
        contributorIds: unique(
          items.flatMap((c) => c.contributions.map((x) => x.personId)),
        ),
        openItems: last.openItems,
        nextStep: last.nextStep,
        dates: unique(items.map((c) => c.date)),
      };
    })
    .sort(
      (a, b) =>
        b.last.date.localeCompare(a.last.date) ||
        b.changeIds.length - a.changeIds.length,
    );
}

export function milestoneMoves(
  plans: DeliveryPlan[] | undefined,
  projectIds: string[],
  range: { start: string; end: string },
  end: string,
): MilestoneMove[] {
  const before = new Map(
    plansAt(plans, addDays(range.start, -1)).map((p) => [p.projectId, p]),
  );
  const after = plansAt(plans, end).filter((p) =>
    projectIds.includes(p.projectId),
  );
  const moves: MilestoneMove[] = [];
  for (const plan of after) {
    const prior = before.get(plan.projectId);
    for (const m of plan.milestones) {
      const from = prior?.milestones.find((x) => x.id === m.id)?.state;
      // A newly introduced milestone that is still only planned is scope, not movement.
      if (from !== m.state && !(from === undefined && m.state === "planned"))
        moves.push({
          projectId: plan.projectId,
          milestoneId: m.id,
          title: m.title,
          from,
          to: m.state,
          target: m.target,
        });
    }
  }
  return moves;
}

export function buildDigest(input: {
  period: Period;
  range: { start: string; end: string };
  end: string;
  asOf: string;
  root: BriefNode;
  changes: Change[];
  evidence: Evidence[];
  plans?: DeliveryPlan[];
  projectIds: string[];
  copies: BriefCopy[];
  subject: { kind: "projects" | "people"; id: string };
}): PeriodDigest {
  const { period, range, end, asOf, root, changes, evidence } = input;
  const slots: PeriodSlot[] = slotWindows(period, range).map((w) => {
    const inWindow = changes.filter((c) => c.date >= w.start && c.date <= w.end);
    const copy = input.copies.find(
      (c) =>
        c.period === w.period &&
        c.subject.kind === input.subject.kind &&
        c.subject.id === input.subject.id &&
        c.start <= w.start &&
        c.end >= w.end,
    );
    return {
      start: w.start,
      end: w.end,
      period: w.period,
      label: slotLabel(w.period, w.start, w.end),
      changeIds: inWindow.map((c) => c.id),
      evidenceIds: unique(inWindow.flatMap((c) => c.evidenceIds)),
      projectIds: unique(inWindow.map((c) => c.projectId)),
      headline: copy?.headline,
      future: w.start > asOf,
    };
  });
  const used = evidence.filter((e) => root.evidenceIds.includes(e.id));
  const sources = [...new Set(used.map((e) => e.source))]
    .map((source) => ({
      source,
      count: used.filter((e) => e.source === source).length,
    }))
    .sort((a, b) => b.count - a.count || a.source.localeCompare(b.source));
  const contributorIds = unique(
    changes.flatMap((c) => c.contributions.map((x) => x.personId)),
  );
  return {
    unit: unitOf[period],
    slots,
    streams: streamsOf(changes),
    milestoneMoves: milestoneMoves(input.plans, input.projectIds, range, end),
    sources,
    contributors: contributorIds.map((personId) => {
      const mine = changes.filter((c) =>
        c.contributions.some((x) => x.personId === personId),
      );
      return {
        personId,
        changeIds: mine.map((c) => c.id),
        projectIds: unique(mine.map((c) => c.projectId)),
      };
    }),
    recordedDays: root.observedDates.length,
  };
}
