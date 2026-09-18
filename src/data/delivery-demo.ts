import type { DeliveryPlan, DeliveryTask, Evidence } from "@/lib/contracts";

// Fictional project-owner plans. No Jira import, live on-call rota or deployment is implied.
export const deliveryEvidence: Evidence[] = [
  {
    id: "retry-baseline",
    projectId: "praetorian",
    date: "2026-09-07",
    title: "Retry baseline review",
    source: "Project plan",
    basis: "source",
    summary:
      "The project owner accepted the timeout and stale-context failure cases as the scope of the recovery milestone.",
    limitation:
      "Scope acceptance only. The implementation and release still need separate verification.",
    items: [
      "Timeout during recovery",
      "Stale context reused after a retry",
      "Eight checks selected for the local validation matrix",
    ],
    restricted: false,
  },
];

const criterion = (
  label: string,
  state: "met" | "not-met" | "unknown" = "unknown",
  evidenceIds: string[] = [],
) => ({ label, state, evidenceIds });
const task = (
  id: string,
  milestoneId: string,
  title: string,
  status: DeliveryTask["status"],
  ownerId: string,
  summary: string,
  acceptance: string[],
  evidenceIds: string[] = [],
  dependsOn: string[] = [],
  blocker?: string,
): DeliveryTask => ({
  id,
  milestoneId,
  title,
  status,
  ownerId,
  summary,
  acceptance,
  evidenceIds,
  dependsOn,
  ...(blocker ? { blocker } : {}),
});

const retryPlan: DeliveryPlan = {
  id: "praetorian-plan-sep9",
  headline: "Two recovery checks remain before release review.",
  projectId: "praetorian",
  asOf: "2026-09-09",
  origin: "Project-owner plan",
  objective:
    "Keep review findings intact when an agent retries. Release only after recovery checks and review agree.",
  decision:
    "Recovery validation is the next gate: timeout and stale-context checks still fail. Release review can start after both pass.",
  milestones: [
    {
      id: "baseline",
      title: "Failure baseline",
      outcome: "Agree on reproducible failure cases and the validation matrix.",
      target: "2026-09-07",
      state: "complete",
      criteria: [
        criterion("Failure cases and eight-check matrix accepted", "met", [
          "retry-baseline",
        ]),
      ],
    },
    {
      id: "recovery",
      title: "Recovery validated",
      outcome: "All eight local retry checks pass on the same revision.",
      target: "2026-09-11",
      state: "active",
      criteria: [
        criterion("Timeout recovery passes", "not-met", ["run-184"]),
        criterion("Stale-context reuse is prevented", "not-met", ["run-184"]),
        criterion("Remaining six regression checks pass", "met", ["run-184"]),
      ],
    },
    {
      id: "release",
      title: "Release reviewed",
      outcome:
        "Approve the current revision, merge it, and verify the rollback procedure.",
      target: "2026-09-15",
      state: "planned",
      criteria: [
        criterion("Current revision reviewed and merged"),
        criterion("Rollback procedure reviewed"),
      ],
    },
    {
      id: "pilot",
      title: "Pilot observed",
      outcome:
        "Run a bounded pilot and record recovery behavior before broader rollout.",
      target: "2026-09-18",
      state: "planned",
      criteria: [
        criterion("Pilot deployment recorded"),
        criterion("Recovery behavior reviewed after the observation window"),
      ],
    },
  ],
  tasks: [
    task(
      "PRT-101",
      "baseline",
      "Agree on retry failure cases",
      "done",
      "zhiyuan",
      "Timeout recovery and stale-context reuse are the two failure modes in scope.",
      ["Review same-revision failure cases", "Record the eight-check matrix"],
      ["retry-baseline"],
    ),
    task(
      "PRT-102",
      "recovery",
      "Bound timeout recovery",
      "doing",
      "zhiyuan",
      "Keep retry work inside its recovery budget without discarding valid findings. The timeout case failed in run #184.",
      [
        "Timeout case passes on the current revision",
        "Recovery stops at the configured budget",
      ],
      ["run-184", "agent-retry"],
      ["PRT-101"],
      "Timeout check still fails",
    ),
    task(
      "PRT-103",
      "recovery",
      "Refresh stale review context",
      "doing",
      "marcus",
      "Invalidate context from a previous review cycle before retrying. A stale-context case is still unresolved.",
      ["Previous-cycle context cannot be reused", "Stale-context check passes"],
      ["review-297", "run-184"],
      ["PRT-101"],
      "Stale-context check still fails",
    ),
    task(
      "PRT-104",
      "recovery",
      "Review bounded retry changes",
      "review",
      "marcus",
      "PR #297 is open. Review the recovery behavior against the current revision; the collected snapshot does not show approval or merge.",
      [
        "Review refers to the tested revision",
        "Resolve review observations before merge",
      ],
      ["pr-297", "review-297"],
      ["PRT-102", "PRT-103"],
    ),
    task(
      "PRT-105",
      "recovery",
      "Verify six regression cases",
      "done",
      "zhiyuan",
      "Six of eight checks passed in local run #184. This task covers only those six regression cases, not the two failing cases or deployment.",
      [
        "Six regression checks pass locally",
        "Keep failed cases visible as separate work",
      ],
      ["run-184"],
    ),
    task(
      "PRT-106",
      "recovery",
      "Re-run the complete matrix",
      "planned",
      "zhiyuan",
      "After both fixes, run all eight cases together against one revision and attach the result.",
      [
        "All eight checks pass on one revision",
        "Attach the test record and revision",
      ],
      [],
      ["PRT-102", "PRT-103"],
    ),
    task(
      "PRT-107",
      "release",
      "Merge the reviewed revision",
      "planned",
      "marcus",
      "Confirm review and validation refer to the same commit before merging.",
      ["Review approval recorded", "Merge record matches the tested revision"],
      [],
      ["PRT-104", "PRT-106"],
    ),
    task(
      "PRT-108",
      "release",
      "Review rollback instructions",
      "planned",
      "marcus",
      "Check the recovery runbook and rollback criteria before a pilot deployment.",
      [
        "Runbook reviewed by a maintainer",
        "Rollback condition and escalation owner recorded",
      ],
      [],
      ["PRT-106"],
    ),
    task(
      "PRT-109",
      "pilot",
      "Observe a bounded pilot",
      "planned",
      "zhiyuan",
      "Capture recovery outcomes in a small pilot. No pilot deployment has been collected yet.",
      [
        "Deployment identity and observation window recorded",
        "Pilot result reviewed before wider rollout",
      ],
      [],
      ["PRT-107", "PRT-108"],
    ),
  ],
  resources: [
    {
      id: "recovery-runbook",
      kind: "runbook",
      title: "Recovery triage",
      summary:
        "Start here when a review stalls or shows findings from an older cycle.",
      sections: [
        {
          title: "Establish the affected revision",
          text: "Record the review-cycle ID, commit SHA and failing check. Compare them with the last successful review. Do not treat an older review as the current result.",
        },
        {
          title: "Separate the two failure paths",
          text: "For a timeout, inspect the recovery budget. For reused findings, compare the context revision with the active review. The current local result still fails both checks.",
        },
        {
          title: "Handoff with evidence",
          text: "Attach a sanitized test result to the affected task. Zhiyuan maintains retry handling; Marcus reviews context invalidation. This is project ownership, not a live on-call schedule.",
        },
      ],
      taskIds: ["PRT-102", "PRT-103", "PRT-108"],
      evidenceIds: ["run-184", "review-297"],
    },
    {
      id: "repo-context",
      kind: "repository",
      title: "Review service · PR #297",
      summary: "Bounded retry changes and their current repository state.",
      sections: [
        {
          title: "Change boundary",
          text: "Retry orchestration, context refresh and review-state cleanup are in scope. The original source code and agent transcripts are not included here.",
        },
        {
          title: "Collected state",
          text: "The September 9 GitHub snapshot has PR #297 open. There is no merge or deployment record in this example.",
        },
      ],
      taskIds: ["PRT-104", "PRT-107"],
      evidenceIds: ["pr-297"],
    },
    {
      id: "retry-design",
      kind: "design",
      title: "Retry validation contract",
      summary: "Why these gates exist and what counts as a passing result.",
      sections: [
        {
          title: "Success condition",
          text: "Preserve source-grounded findings, bound recovery work, and isolate review cycles. All eight local checks must pass on the revision submitted for release review.",
        },
        {
          title: "Deliberate boundaries",
          text: "A session summary describes implementation work. A test result describes a check. Neither proves a deployment. Each delivery gate needs its own record.",
        },
      ],
      taskIds: ["PRT-101", "PRT-106"],
      evidenceIds: ["retry-baseline", "run-184"],
    },
  ],
  relatedProjects: [
    {
      projectId: "stride",
      relation: "Shares approved review outcomes with work briefs",
    },
    {
      projectId: "verity",
      relation: "Uses inspectable evidence normalization",
    },
  ],
};

const retrySep8: DeliveryPlan = {
  ...retryPlan,
  id: "praetorian-plan-sep8",
  headline: "Retry changes are drafted. Validation is next.",
  asOf: "2026-09-08",
  decision:
    "Bounded retry changes are drafted. Local validation has not been recorded yet.",
  milestones: retryPlan.milestones.map((m) =>
    m.id === "recovery"
      ? { ...m, criteria: m.criteria.map((c) => criterion(c.label)) }
      : m,
  ),
  tasks: retryPlan.tasks.map((t) =>
    t.id === "PRT-101"
      ? t
      : {
          ...t,
          status: t.id === "PRT-102" ? "doing" : "planned",
          evidenceIds: t.id === "PRT-102" ? ["retry-sep8"] : [],
          blocker: undefined,
          summary:
            t.id === "PRT-102"
              ? "Bounded retry handling is drafted; a captured validation result is still needed."
              : `Planned work: ${t.title.toLowerCase()}.`,
        },
  ),
  resources: [],
  relatedProjects: [],
};
const retrySep4: DeliveryPlan = {
  ...retrySep8,
  id: "praetorian-plan-sep4",
  headline: "Establish the failure cases before building the fix.",
  asOf: "2026-09-04",
  decision:
    "Compare timeout and stale-context failures before selecting a recovery design.",
  milestones: retryPlan.milestones.map((m) => ({
    ...m,
    state: m.id === "baseline" ? "active" : "planned",
    criteria: m.criteria.map((c) => criterion(c.label)),
  })),
  tasks: [
    task(
      "PRT-101",
      "baseline",
      "Compare retry failure cases",
      "doing",
      "zhiyuan",
      "Compare timeout and stale-context behavior on the same revision.",
      ["Document reproducible failure cases"],
      ["retry-sep4"],
    ),
  ],
};

const stridePlan: DeliveryPlan = {
  id: "stride-plan-sep9",
  headline: "Verify the brief path, then select two pilot teams.",
  projectId: "stride",
  asOf: "2026-09-09",
  origin: "Project-owner plan",
  objective:
    "Test whether evidence-backed briefs help two pilot teams understand progress without collecting private conversations.",
  decision:
    "GitHub linking is reported working locally. The next decision is which two teams will evaluate the brief.",
  milestones: [
    {
      id: "brief-path",
      title: "Brief path verified",
      outcome:
        "Trace a GitHub change into a manager-safe brief with working evidence links.",
      state: "active",
      target: "2026-09-14",
      criteria: [
        criterion("Evidence links verified end to end"),
        criterion("Private records excluded from shared payloads"),
      ],
    },
    {
      id: "pilot-teams",
      title: "Pilot teams ready",
      outcome: "Two teams agree on scope, permissions and feedback questions.",
      state: "planned",
      target: "2026-09-18",
      criteria: [
        criterion("Two teams identified"),
        criterion("Pilot scope agreed"),
      ],
    },
    {
      id: "feedback",
      title: "Usefulness reviewed",
      outcome: "Review usefulness and correction feedback before expanding.",
      state: "planned",
      target: "2026-09-30",
      criteria: [
        criterion("Pilot feedback collected"),
        criterion("Proceed or revise decision recorded"),
      ],
    },
  ],
  tasks: [
    task(
      "STD-201",
      "brief-path",
      "Link GitHub changes to briefs",
      "doing",
      "zhiyuan",
      "GitHub linking is reported working locally; independent end-to-end proof is not yet attached.",
      [
        "Trace a brief claim to its source",
        "Preserve the source date and scope",
      ],
      ["stride-note"],
    ),
    task(
      "STD-202",
      "brief-path",
      "Verify the shared payload boundary",
      "planned",
      "zhiyuan",
      "Inspect the manager-facing response for private prompts, messages and unrestricted raw records.",
      [
        "No raw private content in the browser payload",
        "Evidence access follows the viewer’s scope",
      ],
    ),
    task(
      "STD-203",
      "pilot-teams",
      "Select two pilot teams",
      "doing",
      "elena",
      "The pilot selection criteria are documented, but no team has been selected yet.",
      ["Two teams agree to participate", "Record the feedback questions"],
      ["manager-note"],
      [],
      "Pilot teams not selected",
    ),
    task(
      "STD-204",
      "feedback",
      "Review the first week of feedback",
      "planned",
      "elena",
      "Review usefulness, missing context and corrections. Adoption counts alone do not establish value.",
      [
        "Record feedback from both pilot teams",
        "Document the next product decision",
      ],
      [],
      ["STD-201", "STD-202", "STD-203"],
    ),
  ],
  resources: [
    {
      id: "pilot-scope",
      kind: "handoff",
      title: "Pilot scope & questions",
      summary: "What the first two teams will evaluate.",
      sections: [
        {
          title: "Pilot intent",
          text: "Can a manager understand progress and a developer correct the context without extra reporting overhead? Start with the optional sources each team already has.",
        },
        {
          title: "Before inviting teams",
          text: "Verify evidence access and the shared payload boundary. Elena coordinates team selection; Zhiyuan owns the brief path. No automatic outreach is configured.",
        },
      ],
      taskIds: ["STD-201", "STD-202", "STD-203"],
      evidenceIds: ["stride-note", "manager-note"],
    },
  ],
  relatedProjects: [
    {
      projectId: "verity",
      relation: "Normalizes source records before brief generation",
    },
    { projectId: "praetorian", relation: "Consumes approved review outcomes" },
  ],
};

const verityPlan: DeliveryPlan = {
  id: "verity-plan-sep8",
  headline: "CSV validation passed. Deployment checks come next.",
  projectId: "verity",
  asOf: "2026-09-08",
  origin: "Project-owner plan",
  objective:
    "Let a reviewer follow a dataset from import through filtering to export, then verify deployment separately.",
  decision:
    "The local CSV workflow passes. Deployment configuration is the next verification boundary.",
  milestones: [
    {
      id: "csv-path",
      title: "CSV path validated",
      outcome: "Import, inspect filter changes and export a dataset locally.",
      state: "complete",
      target: "2026-09-08",
      criteria: [
        criterion("Import, inspect and export pass locally", "met", [
          "verity-run",
        ]),
      ],
    },
    {
      id: "deploy-check",
      title: "Deployment checked",
      outcome:
        "Verify configuration, storage and access controls in the target environment.",
      state: "active",
      target: "2026-09-16",
      criteria: [
        criterion("Deployment configuration reviewed"),
        criterion("Persistent storage and access tested"),
      ],
    },
    {
      id: "replay",
      title: "Replay demonstrated",
      outcome:
        "Re-run a saved pipeline on another dataset and compare results.",
      state: "planned",
      target: "2026-09-21",
      criteria: [criterion("Second-dataset replay recorded")],
    },
  ],
  tasks: [
    task(
      "VER-301",
      "csv-path",
      "Verify import, filter and export",
      "done",
      "maya",
      "The local end-to-end CSV workflow passed on September 8.",
      [
        "CSV imports successfully",
        "Filter changes are inspectable",
        "Result exports successfully",
      ],
      ["verity-run"],
    ),
    task(
      "VER-302",
      "deploy-check",
      "Inspect deployment configuration",
      "planned",
      "maya",
      "Review the target environment after local validation. No deployment is recorded.",
      ["Storage, access and runtime configuration reviewed"],
      ["verity-note"],
      ["VER-301"],
    ),
    task(
      "VER-303",
      "deploy-check",
      "Test storage and access isolation",
      "planned",
      "maya",
      "Verify persistence and project-scoped access before sharing the deployment.",
      ["Data survives a restart", "Access does not cross project boundaries"],
      [],
      ["VER-302"],
    ),
    task(
      "VER-304",
      "replay",
      "Replay on a second dataset",
      "planned",
      "maya",
      "Load a saved pipeline and inspect every transformation on another sample.",
      [
        "Saved pipeline reproduces its transformations",
        "Differences are explainable",
      ],
      [],
      ["VER-303"],
    ),
  ],
  resources: [
    {
      id: "csv-contract",
      kind: "design",
      title: "CSV workflow boundary",
      summary: "What the local result covers, and what remains unverified.",
      sections: [
        {
          title: "Verified locally",
          text: "The CSV import, filter preview and export path passed. The result does not cover a deployed service or other input formats.",
        },
        {
          title: "Next verification",
          text: "Check deployment configuration, durable storage and access boundaries before allowing another team to use the service.",
        },
      ],
      taskIds: ["VER-301", "VER-302"],
      evidenceIds: ["verity-run", "verity-note"],
    },
  ],
  relatedProjects: [
    {
      projectId: "stride",
      relation: "Provides inspectable source normalization",
    },
  ],
};

export const deliveryPlans: DeliveryPlan[] = [
  retrySep4,
  retrySep8,
  retryPlan,
  stridePlan,
  verityPlan,
];
// Research and Risk intentionally have no delivery-plan snapshot. Notes do not create a plan.
