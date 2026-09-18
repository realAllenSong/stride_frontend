import {
  DailyBriefSchema,
  EvidenceSchema,
  type Workspace,
  type Change,
  type Evidence,
} from "@/lib/contracts";
import { rollup, subjectFilter } from "@/lib/briefs";
import { deliveryEvidence, deliveryPlans } from "./delivery-demo";
import { historyChanges, historyEvidence } from "./history-demo";
import { demoCopies } from "./copies-demo";

// Authored, sanitized fixtures only. Never harvested from local sessions or company systems.
const evidence: Evidence[] = [
  ...deliveryEvidence,
  ...historyEvidence,
  {
    id: "investigation-aug",
    projectId: "praetorian",
    date: "2026-08-31",
    title: "Retry failure investigation",
    source: "Agent sessions",
    basis: "reported",
    summary:
      "Investigated how review findings can be lost when a retry starts with stale context.",
    limitation:
      "An investigation report, not an implemented or deployed change.",
    items: [],
    restricted: false,
  },
  {
    id: "retry-sep4",
    projectId: "praetorian",
    date: "2026-09-04",
    title: "Failure modes compared",
    source: "Agent sessions",
    basis: "reported",
    summary:
      "Compared timeout recovery and stale-context behavior on the same revision.",
    limitation:
      "No passing test or deployment record was collected for this date.",
    items: [],
    restricted: false,
  },
  {
    id: "retry-sep7",
    projectId: "praetorian",
    date: "2026-09-07",
    title: "Retry approach narrowed",
    source: "Agent sessions",
    basis: "reported",
    summary:
      "Selected bounded retries and explicit context refresh for further implementation.",
    limitation: "A reported design decision, not a completed implementation.",
    items: [],
    restricted: false,
  },
  {
    id: "retry-sep8",
    projectId: "praetorian",
    date: "2026-09-08",
    title: "Bounded retry changes drafted",
    source: "Agent sessions",
    basis: "reported",
    summary:
      "Drafted bounded retry handling and cleanup of stale review state.",
    limitation: "Agent narration does not establish that validation passed.",
    items: [],
    restricted: false,
  },
  {
    id: "run-184",
    projectId: "praetorian",
    date: "2026-09-09",
    title: "Local test run #184",
    source: "Local test",
    basis: "captured",
    summary: "6 of 8 retry checks passed on the local working revision.",
    limitation:
      "This local test does not establish deployment or project completion.",
    items: [
      "Passed: 6 checks",
      "Failed: Timeout recovery",
      "Failed: Stale-context reuse",
    ],
    restricted: false,
    criteria: { timeout: "not-met", context: "not-met" },
  },
  {
    id: "pr-297",
    projectId: "praetorian",
    date: "2026-09-09",
    title: "GitHub PR #297",
    source: "GitHub",
    basis: "source",
    summary:
      "The bounded retry pull request was open in the collected repository snapshot.",
    limitation: "An open pull request is not a merge or deployment result.",
    items: ["State: Open", "Scope: Bounded retry changes"],
    restricted: false,
    criteria: { merged: "unknown" },
  },
  {
    id: "review-297",
    projectId: "praetorian",
    date: "2026-09-09",
    title: "Stale-context review comment",
    source: "GitHub",
    basis: "source",
    summary:
      "Marcus identified a stale-context case to include in retry validation.",
    limitation:
      "A review observation does not establish that the issue was resolved.",
    items: [],
    restricted: false,
  },
  {
    id: "agent-retry",
    projectId: "praetorian",
    date: "2026-09-09",
    title: "Approved session summary",
    source: "Agent sessions",
    basis: "reported",
    summary: "Zhiyuan worked on bounded retry handling and context refresh.",
    limitation:
      "The original session is private. Only the approved summary is included.",
    items: [],
    restricted: true,
  },
  {
    id: "retry-note",
    projectId: "praetorian",
    date: "2026-09-09",
    title: "Zhiyuan’s next step",
    source: "Personal note",
    basis: "reported",
    summary:
      "Re-run the timeout recovery and stale-context tests on the current changes.",
    limitation: "A recorded plan, not a completed action.",
    items: [],
    restricted: false,
  },
  {
    id: "stride-note",
    projectId: "stride",
    date: "2026-09-09",
    title: "Zhiyuan’s shared note",
    source: "Personal note",
    basis: "reported",
    summary:
      "GitHub linking works locally. Need two pilot teams to test whether the briefs are useful.",
    limitation:
      "A personal report and an explicit support request. No independent test or decision is recorded.",
    items: [],
    restricted: false,
  },
  {
    id: "verity-run",
    projectId: "verity",
    date: "2026-09-08",
    title: "Local CSV workflow test",
    source: "Local test",
    basis: "captured",
    summary:
      "The CSV import, filter preview and export workflow passed a local end-to-end test.",
    limitation:
      "This bounded local test does not establish deployment readiness.",
    items: ["CSV import: passed", "Filter preview: passed", "Export: passed"],
    restricted: false,
    criteria: { import: "met", inspect: "met", export: "met" },
  },
  {
    id: "verity-note",
    projectId: "verity",
    date: "2026-09-08",
    title: "Maya’s next step",
    source: "Personal note",
    basis: "reported",
    summary:
      "Review the deployment configuration after the local CSV workflow test.",
    limitation: "No deployment result is included in this snapshot.",
    items: [],
    restricted: false,
  },
  {
    id: "maya-note",
    projectId: "research",
    date: "2026-09-09",
    title: "Maya’s shared research note",
    source: "Personal note",
    basis: "reported",
    summary:
      "Compared two indexing approaches. Selected one for a small prototype; next I’ll test it on a small dataset.",
    limitation:
      "Self-reported research. No prototype outcome has been verified.",
    items: [],
    restricted: false,
  },
  {
    id: "risk-note",
    projectId: "risk",
    date: "2026-09-04",
    title: "Reconciliation review note",
    source: "Personal note",
    basis: "reported",
    summary: "Reviewed the reconciliation rules for the incoming dataset.",
    limitation:
      "This is the September 4 record, not evidence of work on later dates.",
    items: [],
    restricted: false,
  },
  {
    id: "manager-note",
    projectId: "stride",
    date: "2026-09-09",
    title: "Elena’s shared planning note",
    source: "Personal note",
    basis: "reported",
    summary:
      "Documented pilot selection criteria and the questions the team wants to answer with the first briefs.",
    limitation: "Planning work only. No pilot team has been selected.",
    items: [],
    restricted: false,
  },
];
const change = (
  partial: Partial<Change> &
    Pick<
      Change,
      "id" | "date" | "projectId" | "title" | "detail" | "evidenceIds"
    >,
): Change => ({
  workId: partial.id,
  basis: "reported",
  contributions: [],
  openItems: [],
  ...partial,
});
const changes: Change[] = [
  ...historyChanges,
  change({
    id: "retry-aug",
    workId: "retry-recovery",
    projectId: "praetorian",
    date: "2026-08-31",
    title: "Investigation started",
    detail: "Investigated why review findings can disappear during retries.",
    evidenceIds: ["investigation-aug"],
    contributions: [
      {
        personId: "zhiyuan",
        description: "Investigated retry failure paths",
        basis: "reported",
      },
    ],
  }),
  change({
    id: "retry-sep4",
    workId: "retry-recovery",
    projectId: "praetorian",
    date: "2026-09-04",
    title: "Retry failure modes compared",
    detail: "Compared timeout and stale-context behavior on the same revision.",
    evidenceIds: ["retry-sep4"],
    contributions: [
      {
        personId: "zhiyuan",
        description: "Compared the failure modes",
        basis: "reported",
      },
    ],
  }),
  change({
    id: "risk-review",
    workId: "risk-reconcile",
    projectId: "risk",
    date: "2026-09-04",
    title: "Reconciliation rules were reviewed",
    detail: "Reported in a project note. No later update was collected.",
    evidenceIds: ["risk-note"],
    contributions: [
      {
        personId: "priya",
        description: "Reviewed reconciliation rules",
        basis: "reported",
      },
    ],
  }),
  change({
    id: "retry-sep7",
    workId: "retry-recovery",
    projectId: "praetorian",
    date: "2026-09-07",
    title: "Retry approach narrowed",
    detail: "Selected bounded retries and explicit context refresh.",
    evidenceIds: ["retry-sep7"],
    contributions: [
      {
        personId: "zhiyuan",
        description: "Narrowed the retry approach",
        basis: "reported",
      },
    ],
  }),
  change({
    id: "retry-sep8",
    workId: "retry-recovery",
    projectId: "praetorian",
    date: "2026-09-08",
    title: "Bounded retry changes drafted",
    detail:
      "Prepared retry limits and stale-state cleanup for local validation.",
    evidenceIds: ["retry-sep8"],
    contributions: [
      {
        personId: "zhiyuan",
        description: "Drafted bounded retry changes",
        basis: "reported",
      },
    ],
  }),
  change({
    id: "verity-local",
    workId: "verity-workflow",
    projectId: "verity",
    date: "2026-09-08",
    title: "CSV import to export passed",
    detail:
      "Import, filter preview and export passed a local test. Deployment is not verified.",
    value: "Makes changes to a dataset inspectable before export.",
    basis: "captured",
    evidenceIds: ["verity-run", "verity-note"],
    contributions: [
      {
        personId: "maya",
        description: "Validated the local CSV workflow",
        basis: "captured",
      },
    ],
    nextStep: {
      text: "Review deployment configuration",
      evidenceId: "verity-note",
    },
  }),
  change({
    id: "retry-sep9",
    workId: "retry-recovery",
    projectId: "praetorian",
    date: "2026-09-09",
    title: "6 of 8 retry checks passed",
    detail: "Timeout recovery and stale-context reuse remain unresolved.",
    value: "Keeps review findings available through retries and reanalysis.",
    basis: "captured",
    evidenceIds: [
      "run-184",
      "pr-297",
      "review-297",
      "agent-retry",
      "retry-note",
    ],
    contributions: [
      {
        personId: "zhiyuan",
        description: "Added bounded retry handling",
        basis: "reported",
      },
      {
        personId: "marcus",
        description: "Flagged stale-context reuse",
        basis: "source",
      },
    ],
    openItems: ["Timeout recovery", "Stale-context reuse"],
    nextStep: {
      text: "Re-run the two failing checks",
      evidenceId: "retry-note",
    },
  }),
  change({
    id: "stride-link",
    workId: "stride-shape",
    projectId: "stride",
    date: "2026-09-09",
    title: "GitHub linking working locally",
    detail: "Reported in a shared note. Pilot teams have not been selected.",
    value:
      "Links work summaries to evidence without sharing raw conversations.",
    evidenceIds: ["stride-note"],
    contributions: [
      {
        personId: "zhiyuan",
        description: "Connected GitHub linking locally",
        basis: "reported",
      },
    ],
    support: { text: "Select two pilot teams", evidenceId: "stride-note" },
  }),
  change({
    id: "research-compare",
    workId: "research-indexing",
    projectId: "research",
    date: "2026-09-09",
    title: "Compared two indexing approaches",
    detail:
      "Selected one for a small prototype. The prototype outcome is not yet verified.",
    value: "Helps researchers explore datasets with less repeated setup.",
    evidenceIds: ["maya-note"],
    contributions: [
      {
        personId: "maya",
        description: "Compared two indexing approaches",
        basis: "reported",
      },
    ],
    nextStep: {
      text: "Test the approach on a small dataset",
      evidenceId: "maya-note",
    },
  }),
  change({
    id: "pilot-criteria",
    workId: "stride-pilot",
    projectId: "stride",
    date: "2026-09-09",
    title: "Pilot selection criteria documented",
    detail:
      "Outlined the questions for the pilot. Team selection remains open.",
    evidenceIds: ["manager-note"],
    contributions: [
      {
        personId: "elena",
        description: "Documented pilot selection criteria",
        basis: "reported",
      },
    ],
  }),
];
const presentation: Record<string, Partial<Change>> = {
  "retry-sep9": {
    headline: "Two retry checks still need work.",
    subheading: "Latest local run: 6 of 8 checks passed.",
    facts: [
      {
        label: "Local tests: 6 / 8 passed",
        context: "Test run #184 · Sep 9",
        kind: "result",
        evidenceId: "run-184",
      },
      {
        label: "Pull request: Open",
        context: "#297 · Sep 9",
        kind: "repository",
        evidenceId: "pr-297",
      },
      {
        label: "Deployment: Not verified",
        context: "No evidence collected",
        kind: "deployment",
      },
    ],
  },
  "stride-link": {
    headline: "Local linking is reported working.",
    noteEvidenceId: "stride-note",
  },
  "research-compare": {
    headline: "Research work, captured in a note.",
    noteEvidenceId: "maya-note",
  },
  "verity-local": {
    checkpoints: ["Import", "Inspect changes", "Export"].map((label) => ({
      label,
      evidenceId: "verity-run",
    })),
  },
};
export const demoWorkspace: Workspace = {
  deliveryPlans,
  sourceStates: [
    {
      source: "Jira",
      status: "connected",
      asOf: "2026-09-09",
      projectIds: ["praetorian", "stride", "verity", "research", "risk"],
    },
    {
      source: "Confluence",
      status: "connected",
      asOf: "2026-09-09",
      projectIds: ["praetorian", "stride", "verity", "research", "risk"],
    },
    {
      source: "Microsoft work",
      status: "unavailable",
      asOf: "2026-09-09",
      note: "Not connected in this example",
      projectIds: ["praetorian", "stride", "verity", "research", "risk"],
    },
    {
      source: "Slack",
      status: "unavailable",
      asOf: "2026-09-09",
      note: "Not connected in this example",
      projectIds: ["praetorian", "stride", "verity", "research", "risk"],
    },
  ],
  briefCopies: demoCopies,
  suggestions: [
    {
      id: "retry-checklist",
      personId: "zhiyuan",
      workId: "retry-recovery",
      title: "Keep a short retry-check checklist.",
      reason:
        "Your recent sessions returned to timeout and stale-context checks.",
      steps: [
        "Confirm the commit being tested.",
        "Include timeout and stale-context cases.",
        "Keep local tests and deployment results separate.",
      ],
      expectedBenefit: "Fewer missed checks when repeating this workflow.",
    },
  ],
  asOf: "2026-09-09",
  groups: [
    { id: "infra", name: "AI/ML Infrastructure" },
    { id: "quant", name: "Quant Research" },
    { id: "risk", name: "Risk Systems" },
  ],
  people: [
    {
      id: "zhiyuan",
      name: "Zhiyuan Song",
      initials: "ZS",
      groupId: "infra",
      role: "Software Engineer",
      color: "mint",
      reportsTo: "elena",
    },
    {
      id: "maya",
      name: "Maya Patel",
      initials: "MP",
      groupId: "quant",
      role: "Research Engineer",
      color: "sand",
      reportsTo: "elena",
    },
    {
      id: "marcus",
      name: "Marcus Lee",
      initials: "ML",
      groupId: "infra",
      role: "Senior Engineer",
      color: "lavender",
      reportsTo: "elena",
    },
    {
      id: "ethan",
      name: "Ethan Brooks",
      initials: "EB",
      groupId: "infra",
      role: "Software Engineer",
      color: "rose",
      reportsTo: "elena",
    },
    {
      id: "priya",
      name: "Priya Rao",
      initials: "PR",
      groupId: "risk",
      role: "Data Engineer",
      color: "blue",
      reportsTo: "elena",
    },
    {
      id: "elena",
      name: "Elena Novak",
      initials: "EN",
      groupId: "infra",
      role: "Engineering Lead",
      color: "mint",
    },
  ],
  projects: [
    {
      id: "praetorian",
      name: "Praetorian",
      initials: "PR",
      groupId: "infra",
      color: "mint",
      purpose: "Improve review reliability and recovery handling.",
      ownerIds: ["zhiyuan", "marcus"],
      milestone: {
        id: "retry-reliability",
        title: "Preserve review findings through retries",
        configuredAt: "2026-08-31",
        target: "2026-09-11",
        criteria: [
          { id: "timeout", label: "Bounded retries complete without timeout" },
          { id: "context", label: "Review context remains current" },
          { id: "merged", label: "Changes reviewed and merged" },
        ],
      },
    },
    {
      id: "stride",
      name: "STRIDE",
      initials: "ST",
      groupId: "infra",
      color: "blue",
      purpose: "Connect code changes to work summaries.",
      ownerIds: ["zhiyuan"],
      milestone: {
        id: "pilot",
        title: "Evaluate evidence-backed briefs in a small pilot",
        configuredAt: "2026-09-01",
        criteria: [
          { id: "pilot-selected", label: "Pilot teams identified" },
          {
            id: "pilot-feedback",
            label: "Feedback collected on brief usefulness",
          },
        ],
      },
    },
    {
      id: "verity",
      name: "Verity",
      initials: "VE",
      groupId: "infra",
      color: "lavender",
      purpose: "Make data cleaning inspectable from import to export.",
      ownerIds: ["maya"],
      milestone: {
        id: "csv-workflow",
        title: "Make CSV cleaning inspectable end to end",
        configuredAt: "2026-09-01",
        criteria: [
          { id: "import", label: "Import a CSV dataset" },
          { id: "inspect", label: "Inspect the filter changes" },
          { id: "export", label: "Export the resulting dataset" },
        ],
      },
    },
    {
      id: "research",
      name: "Research Workbench",
      initials: "RW",
      groupId: "quant",
      color: "sand",
      purpose: "Enable faster research iteration.",
      ownerIds: ["maya"],
      milestone: {
        id: "indexing",
        title: "Make research datasets easier to explore",
        configuredAt: "2026-09-01",
        criteria: [
          {
            id: "prototype",
            label: "Test the selected indexing approach on a small dataset",
          },
        ],
      },
    },
    {
      id: "risk",
      name: "Risk Data Checks",
      initials: "RD",
      groupId: "risk",
      color: "rose",
      purpose: "Validate and reconcile key data sources.",
      ownerIds: ["priya"],
      milestone: {
        id: "reconcile",
        title: "Validate reconciliation rules on the incoming dataset",
        configuredAt: "2026-09-01",
        criteria: [
          { id: "rules", label: "Review reconciliation rules" },
          { id: "validate", label: "Validate the rules on a sample dataset" },
        ],
      },
    },
  ],
  evidence: evidence.map((e) => EvidenceSchema.parse(e)),
  dailyBriefs: [...new Set(changes.map((c) => c.date))].sort().map((date) =>
    DailyBriefSchema.parse({
      schemaVersion: "1.0",
      id: `daily-${date}`,
      date,
      headline: "Recorded work updates",
      summary: "Updates from available records and shared notes.",
      changes: changes
        .filter((c) => c.date === date)
        .map((c) => ({ ...c, ...presentation[c.id] })),
    }),
  ),
};

// Fixture-only sealing. Generated copy must persist the revision of the inputs it consumed,
// and its child lineage must be the reducer's, not hand-typed.
for (const copy of demoWorkspace.briefCopies ?? []) {
  const { root } = rollup(
    demoWorkspace,
    copy.period,
    copy.start,
    copy.end,
    subjectFilter(demoWorkspace, copy.subject),
  );
  copy.sourceRevision = root.revision;
  copy.childIds = root.childIds;
}
