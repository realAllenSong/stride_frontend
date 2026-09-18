import type { BriefCopy } from "@/lib/contracts";

// Authored examples of generated copy at each level. A generator replaces the text;
// the fields, their bounds and the fixed templates that render them stay the same.
// childIds and sourceRevision are sealed by the reducer at load time.
export const demoCopies: BriefCopy[] = [
  // ---- Praetorian -----------------------------------------------------------
  {
    period: "weekly",
    start: "2026-09-07",
    end: "2026-09-13",
    subject: { kind: "projects", id: "praetorian" },
    headline: "Bounded retries reached a local test run; two checks still fail.",
    summary:
      "The retry approach was narrowed, drafted and run locally within three days. Timeout recovery and stale-context reuse remain open, and the pull request is still in review.",
    childIds: [],
    evidenceIds: ["run-184", "pr-297", "review-297"],
    themes: [
      {
        title: "From approach to a measurable run",
        text: "Monday narrowed the design to bounded retries with explicit context refresh. Tuesday drafted the changes. Wednesday’s local run passed 6 of 8 checks.",
        workIds: ["retry-recovery"],
        evidenceIds: ["run-184"],
      },
      {
        title: "Review is now the constraint",
        text: "PR #297 is open. Marcus flagged a stale-context case that the validation matrix must include before release review can start.",
        workIds: ["retry-recovery"],
        evidenceIds: ["pr-297", "review-297"],
      },
    ],
    carried: ["Timeout recovery", "Stale-context reuse"],
    outlook:
      "Next recorded step is to re-run the two failing checks on the current changes. No release date is implied.",
  },
  {
    period: "weekly",
    start: "2026-08-31",
    end: "2026-09-06",
    subject: { kind: "projects", id: "praetorian" },
    headline: "Investigation turned into a comparison of two failure modes.",
    summary:
      "The week opened with an investigation into lost review findings and closed with timeout and stale-context behavior compared on one revision. Open review comments were triaged midweek.",
    childIds: [],
    evidenceIds: ["investigation-aug", "praetorian-triage", "retry-sep4"],
    themes: [
      {
        title: "Naming the failure modes",
        text: "Timeout recovery and stale-context reuse were isolated as the two paths that lose findings. Both are reported, not yet fixed.",
        workIds: ["retry-recovery"],
        evidenceIds: ["retry-sep4"],
      },
      {
        title: "Review debt made visible",
        text: "Eleven open comments were grouped into timeout, stale context and cleanup so the fix can be scoped against them.",
        workIds: ["retry-review"],
        evidenceIds: ["praetorian-triage"],
      },
    ],
    carried: ["Choose a retry approach", "Resolve grouped review comments"],
  },
  {
    period: "monthly",
    start: "2026-09-01",
    end: "2026-09-30",
    subject: { kind: "projects", id: "praetorian" },
    headline: "Retry recovery reached local validation.",
    summary:
      "Two local checks remain unresolved. The latest collected pull request is still open.",
    childIds: [],
    evidenceIds: ["run-184", "pr-297"],
    arc: "September moved from comparing failure modes to a bounded-retry implementation under local test. The first week named the problem; the second produced a measurable run. Nothing has been deployed.",
    decisions: [
      {
        text: "Bounded retries with explicit context refresh, not unbounded retry",
        evidenceIds: ["retry-sep7"],
      },
      {
        text: "Include the stale-context case in the validation matrix",
        evidenceIds: ["review-297"],
      },
    ],
    risks: [
      "Two of eight retry checks still fail",
      "Release review has not started",
    ],
  },
  {
    period: "monthly",
    start: "2026-08-01",
    end: "2026-08-31",
    subject: { kind: "projects", id: "praetorian" },
    headline: "The flaky retry failure was reproduced, then investigated.",
    summary:
      "A reproduction rate of 3 in 10 local runs gave the investigation a concrete target at the end of the month.",
    childIds: [],
    evidenceIds: ["praetorian-flaky", "investigation-aug"],
    arc: "August was groundwork. The instrumented retry path from July made the lost-findings failure reproducible on a local machine, and the final day opened the investigation that September would carry.",
    decisions: [],
    risks: ["Reproduction observed on one machine only"],
  },
  {
    period: "yearly",
    start: "2026-01-01",
    end: "2026-12-31",
    subject: { kind: "projects", id: "praetorian" },
    headline: "From incident catalogue to a retry fix under local test.",
    summary:
      "Praetorian spent 2026 turning a pattern of lost review findings into a reproducible failure, then into a bounded-retry change that passes most local checks. Deployment is not yet recorded.",
    childIds: [],
    evidenceIds: ["praetorian-incidents", "praetorian-flaky", "run-184"],
    quarters: [
      {
        quarter: 2,
        headline: "Incidents catalogued",
        text: "Seven review incidents were catalogued in June; five involved findings lost after a retry.",
      },
      {
        quarter: 3,
        headline: "Reproduced, then implemented",
        text: "Instrumentation in July made the failure reproducible in August. September narrowed the design and produced a local run with 6 of 8 checks passing.",
      },
    ],
    lessons: [
      "Instrument before fixing: the July logging made the August reproduction possible",
      "Keep local test results separate from deployment claims",
    ],
  },
  // ---- Portfolio (all groups) -----------------------------------------------
  {
    period: "weekly",
    start: "2026-09-07",
    end: "2026-09-13",
    subject: { kind: "projects", id: "group:all" },
    headline: "Retry validation and pilot preparation led the week.",
    summary:
      "Praetorian produced its first measurable retry run. Verity’s CSV workflow passed locally. STRIDE and Research moved through shared notes, and STRIDE asked for two pilot teams.",
    childIds: [],
    evidenceIds: ["run-184", "verity-run", "stride-note", "manager-note"],
    themes: [
      {
        title: "Two projects reached local validation",
        text: "Praetorian’s retry run passed 6 of 8 checks; Verity’s import-to-export workflow passed end to end. Neither result is a deployment.",
        workIds: ["retry-recovery", "verity-workflow"],
        evidenceIds: ["run-184", "verity-run"],
      },
      {
        title: "Pilot preparation for STRIDE",
        text: "Selection criteria were documented and two pilot teams were requested. Team selection remains open.",
        workIds: ["stride-shape", "stride-pilot"],
        evidenceIds: ["stride-note", "manager-note"],
      },
    ],
    carried: [
      "Praetorian: two failing retry checks",
      "STRIDE: select two pilot teams",
      "Verity: review deployment configuration",
    ],
  },
  {
    period: "monthly",
    start: "2026-09-01",
    end: "2026-09-30",
    subject: { kind: "projects", id: "group:all" },
    headline: "September: two local validations, one open support request.",
    summary:
      "Across five projects, Praetorian and Verity reached local validation while STRIDE prepared a pilot. Risk Data Checks has no record after September 4.",
    childIds: [],
    evidenceIds: ["run-184", "verity-run", "stride-note", "risk-note"],
    arc: "The first week set up the month: pilot questions, an export path and review triage. The second week converted that setup into measurable local runs on two projects. Coverage is uneven; missing records are not missing work.",
    decisions: [
      {
        text: "Praetorian: bounded retries with explicit context refresh",
        evidenceIds: ["retry-sep7"],
      },
    ],
    risks: [
      "No Risk Data Checks record since Sep 4",
      "STRIDE pilot teams not selected",
    ],
  },
  {
    period: "yearly",
    start: "2026-01-01",
    end: "2026-12-31",
    subject: { kind: "projects", id: "group:all" },
    headline: "Five projects, three now at or near local validation.",
    summary:
      "2026 records begin in June. Praetorian and Verity have measured local results; STRIDE has a schema, a linking spike and a pilot plan; Research and Risk have preparatory work recorded.",
    childIds: [],
    evidenceIds: ["praetorian-incidents", "verity-import-proto", "run-184"],
    quarters: [
      {
        quarter: 2,
        headline: "Problems framed",
        text: "STRIDE’s question was framed, Verity’s import prototype passed a smoke test and Praetorian’s incidents were catalogued.",
      },
      {
        quarter: 3,
        headline: "Prototypes and first validations",
        text: "Schemas, drafts and prototypes across all five projects, then two local validations in September.",
      },
    ],
    lessons: [
      "Coverage varies by project; the yearly view shows records, not effort",
    ],
  },
  // ---- People -----------------------------------------------------------------
  {
    period: "weekly",
    start: "2026-09-07",
    end: "2026-09-13",
    subject: { kind: "people", id: "zhiyuan" },
    headline: "Retry handling moved from design to a local test run.",
    summary:
      "Three consecutive days on Praetorian’s retry work, ending with 6 of 8 checks passing. A shared STRIDE note reported GitHub linking working locally and asked for pilot teams.",
    childIds: [],
    evidenceIds: ["run-184", "stride-note"],
    themes: [
      {
        title: "Praetorian: bounded retries",
        text: "Narrowed the approach, drafted the changes and ran them locally. Two checks still fail.",
        workIds: ["retry-recovery"],
        evidenceIds: ["run-184"],
      },
      {
        title: "STRIDE: linking reported working",
        text: "A shared note reports local GitHub linking and requests two pilot teams.",
        workIds: ["stride-shape"],
        evidenceIds: ["stride-note"],
      },
    ],
    carried: ["Re-run timeout and stale-context checks"],
  },
  {
    period: "monthly",
    start: "2026-09-01",
    end: "2026-09-30",
    subject: { kind: "people", id: "zhiyuan" },
    headline: "September centred on Praetorian’s retry fix.",
    summary:
      "Four of five recorded updates were on retry recovery, culminating in a local run. One STRIDE note reported linking progress.",
    childIds: [],
    evidenceIds: ["retry-sep4", "run-184"],
    arc: "The month started by comparing failure modes and ended with a bounded-retry implementation under local test. STRIDE work continued in the background through a shared note.",
    decisions: [],
    risks: ["Two retry checks still failing"],
  },
  {
    period: "yearly",
    start: "2026-01-01",
    end: "2026-12-31",
    subject: { kind: "people", id: "zhiyuan" },
    headline: "Two threads: STRIDE’s shape and Praetorian’s retry fix.",
    summary:
      "Records show STRIDE schema and linking work in July and August, then a shift to Praetorian’s retry recovery from late August through September.",
    childIds: [],
    evidenceIds: ["stride-schema", "run-184"],
    quarters: [
      {
        quarter: 3,
        headline: "STRIDE, then Praetorian",
        text: "Brief schema and evidence-linking spike for STRIDE; investigation and bounded-retry implementation for Praetorian.",
      },
    ],
    lessons: [],
  },
  {
    period: "weekly",
    start: "2026-09-07",
    end: "2026-09-13",
    subject: { kind: "people", id: "elena" },
    headline: "Team reached two local validations; pilot selection is the open ask.",
    summary:
      "Zhiyuan and Marcus took Praetorian’s retry fix to a local run. Maya validated Verity’s workflow and compared indexing approaches. Pilot criteria are documented and two pilot teams are requested.",
    childIds: [],
    evidenceIds: ["run-184", "verity-run", "manager-note"],
    themes: [
      {
        title: "Own work: pilot criteria",
        text: "Documented what the first briefs should answer and how pilot teams will be chosen.",
        workIds: ["stride-pilot"],
        evidenceIds: ["manager-note"],
      },
      {
        title: "Team: two projects under local test",
        text: "Praetorian passed 6 of 8 retry checks; Verity passed import-to-export locally.",
        workIds: ["retry-recovery", "verity-workflow"],
        evidenceIds: ["run-184", "verity-run"],
      },
    ],
    carried: ["Select two pilot teams", "Praetorian: two failing checks"],
  },
  {
    period: "monthly",
    start: "2026-09-01",
    end: "2026-09-30",
    subject: { kind: "people", id: "elena" },
    headline: "September: preparation, then measurable runs.",
    summary:
      "Own work framed the pilot. The team moved Praetorian and Verity to local validation and kept Research and Risk moving through notes and reviews.",
    childIds: [],
    evidenceIds: ["pilot-questions", "manager-note", "run-184"],
    arc: "Week one was setup across the team; week two produced results on two projects. Records are thinner for Risk Systems after September 4.",
    decisions: [],
    risks: ["No Risk Data Checks record since Sep 4"],
  },
];
