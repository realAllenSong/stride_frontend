import { z } from "zod";
import { validDate } from "./dates";

export const DateSchema = z
  .string()
  .refine(validDate, "Expected an ISO calendar date (2000-2100)");
export const Id = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9:._-]*$/);
const Title = z.string().trim().min(1).max(120);
const Copy = z.string().trim().min(1).max(420);
export const BasisSchema = z.enum(["captured", "source", "reported"]);
export const ChangeSchema = z.strictObject({
  id: Id,
  workId: Id,
  projectId: Id,
  date: DateSchema,
  title: Title,
  detail: Copy,
  value: Copy.optional(),
  headline: Title.optional(),
  subheading: Copy.optional(),
  basis: BasisSchema,
  evidenceIds: z.array(Id).min(1).max(12),
  contributions: z
    .array(
      z.strictObject({ personId: Id, description: Copy, basis: BasisSchema }),
    )
    .max(12),
  openItems: z.array(Title).max(6),
  nextStep: z.strictObject({ text: Title, evidenceId: Id }).optional(),
  support: z.strictObject({ text: Title, evidenceId: Id }).optional(),
  noteEvidenceId: Id.optional(),
  facts: z
    .array(
      z.strictObject({
        label: Title,
        context: Title,
        kind: z.enum(["result", "repository", "deployment"]),
        evidenceId: Id.optional(),
      }),
    )
    .max(4)
    .optional(),
  checkpoints: z
    .array(z.strictObject({ label: Title, evidenceId: Id }))
    .max(4)
    .optional(),
});
export type Change = z.infer<typeof ChangeSchema>;
export const DailyBriefSchema = z
  .strictObject({
    schemaVersion: z.literal("1.0"),
    id: Id,
    date: DateSchema,
    headline: Title,
    summary: Copy,
    changes: z.array(ChangeSchema).max(100),
  })
  .superRefine((brief, ctx) => {
    brief.changes.forEach((change, index) => {
      if (change.date !== brief.date)
        ctx.addIssue({
          code: "custom",
          path: ["changes", index, "date"],
          message: "A daily change must belong to its brief date",
        });
    });
  });
export type DailyBrief = z.infer<typeof DailyBriefSchema>;
export const EvidenceSchema = z.strictObject({
  id: Id,
  projectId: Id,
  date: DateSchema,
  title: Title,
  source: Title,
  basis: BasisSchema,
  summary: Copy,
  limitation: Copy,
  items: z.array(z.string().max(180)).max(12),
  restricted: z.boolean().default(false),
  criteria: z
    .record(z.string(), z.enum(["met", "not-met", "unknown"]))
    .optional(),
});
export type Evidence = z.infer<typeof EvidenceSchema>;
const Color = z.enum(["mint", "blue", "lavender", "sand", "rose"]);
export const PersonSchema = z.strictObject({
  id: Id,
  name: Title,
  initials: z.string().min(1).max(4),
  groupId: Id,
  role: Title,
  color: Color,
  reportsTo: Id.optional(),
});
export type Person = z.infer<typeof PersonSchema>;
export const GroupSchema = z.strictObject({ id: Id, name: Title });
export type Group = z.infer<typeof GroupSchema>;
export const ProjectSchema = z.strictObject({
  id: Id,
  name: Title,
  initials: z.string().min(1).max(4),
  groupId: Id,
  color: Color,
  purpose: Copy,
  ownerIds: z.array(Id).max(30),
  milestone: z.strictObject({
    id: Id,
    title: Title,
    configuredAt: DateSchema,
    target: DateSchema.optional(),
    criteria: z
      .array(z.strictObject({ id: Id, label: Title }))
      .min(1)
      .max(12),
  }),
});
export type Project = z.infer<typeof ProjectSchema>;
// A delivery plan is an explicitly maintained snapshot, not generated from activity counts.
export const DeliveryPlanSchema = z.strictObject({
  id: Id,
  projectId: Id,
  asOf: DateSchema,
  objective: Copy,
  headline: Title.optional(),
  decision: Copy,
  origin: Title,
  milestones: z
    .array(
      z.strictObject({
        id: Id,
        title: Title,
        outcome: Copy,
        target: DateSchema.optional(),
        state: z.enum(["planned", "active", "complete"]),
        criteria: z
          .array(
            z.strictObject({
              label: Title,
              state: z.enum(["met", "not-met", "unknown"]),
              evidenceIds: z.array(Id).max(12),
            }),
          )
          .min(1)
          .max(12),
      }),
    )
    .min(1)
    .max(12),
  tasks: z
    .array(
      z.strictObject({
        id: Id,
        milestoneId: Id,
        title: Title,
        summary: Copy,
        status: z.enum(["planned", "doing", "review", "done"]),
        ownerId: Id.optional(),
        acceptance: z.array(Title).min(1).max(8),
        evidenceIds: z.array(Id).max(12),
        dependsOn: z.array(Id).max(12),
        blocker: Title.optional(),
      }),
    )
    .max(200),
  resources: z
    .array(
      z.strictObject({
        id: Id,
        kind: z.enum(["runbook", "repository", "design", "handoff"]),
        title: Title,
        summary: Copy,
        sections: z
          .array(z.strictObject({ title: Title, text: Copy }))
          .min(1)
          .max(8),
        taskIds: z.array(Id).max(20),
        evidenceIds: z.array(Id).max(12),
      }),
    )
    .max(30),
  relatedProjects: z
    .array(z.strictObject({ projectId: Id, relation: Title }))
    .max(20),
});
export type DeliveryPlan = z.infer<typeof DeliveryPlanSchema>;
export type DeliveryTask = DeliveryPlan["tasks"][number];
export const SourceStateSchema = z.strictObject({
  source: Title,
  status: z.enum(["connected", "unavailable", "delayed"]),
  asOf: DateSchema,
  note: Title.optional(),
  projectIds: z.array(Id).max(5000),
});
export type SourceState = z.infer<typeof SourceStateSchema>;
export interface Workspace {
  groups: Group[];
  people: Person[];
  projects: Project[];
  evidence: Evidence[];
  dailyBriefs: DailyBrief[];
  asOf: string;
  suggestions?: Suggestion[];
  briefCopies?: BriefCopy[];
  sourceStates?: SourceState[];
  deliveryPlans?: DeliveryPlan[];
}
// Generated narrative is bounded per period. Each level adds only the fields its fixed
// template renders, so weekly/monthly/yearly copy cannot drift into free-form markup.
const CopyBase = {
  start: DateSchema,
  end: DateSchema,
  subject: z.strictObject({ kind: z.enum(["projects", "people"]), id: Id }),
  headline: Title,
  summary: Copy,
  childIds: z.array(Id),
  evidenceIds: z.array(Id),
  sourceRevision: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
};
const Theme = z.strictObject({
  title: Title,
  text: Copy,
  workIds: z.array(Id).max(12).default([]),
  evidenceIds: z.array(Id).max(12).default([]),
});
export const BriefCopySchema = z.discriminatedUnion("period", [
  z.strictObject({ period: z.literal("daily"), ...CopyBase }),
  z.strictObject({
    period: z.literal("weekly"),
    ...CopyBase,
    themes: z.array(Theme).min(1).max(4),
    carried: z.array(Title).max(6).default([]),
    outlook: Copy.optional(),
  }),
  z.strictObject({
    period: z.literal("monthly"),
    ...CopyBase,
    arc: Copy,
    decisions: z
      .array(z.strictObject({ text: Title, evidenceIds: z.array(Id).max(8) }))
      .max(5)
      .default([]),
    risks: z.array(Title).max(4).default([]),
  }),
  z.strictObject({
    period: z.literal("yearly"),
    ...CopyBase,
    quarters: z
      .array(
        z.strictObject({
          quarter: z.number().int().min(1).max(4),
          headline: Title,
          text: Copy,
        }),
      )
      .min(1)
      .max(4),
    lessons: z.array(Title).max(4).default([]),
  }),
]);
export type BriefCopy = z.infer<typeof BriefCopySchema>;
export type WeeklyCopy = Extract<BriefCopy, { period: "weekly" }>;
export type MonthlyCopy = Extract<BriefCopy, { period: "monthly" }>;
export type YearlyCopy = Extract<BriefCopy, { period: "yearly" }>;
export const SuggestionSchema = z.strictObject({
  id: Id,
  personId: Id,
  workId: Id,
  title: Title,
  reason: Copy,
  steps: z.array(Title).min(1).max(5),
  expectedBenefit: Copy,
});
export type Suggestion = z.infer<typeof SuggestionSchema>;
export const WorkspaceSchema = z.strictObject({
  groups: z.array(GroupSchema).max(500),
  people: z.array(PersonSchema).max(5000),
  projects: z.array(ProjectSchema).max(5000),
  evidence: z.array(EvidenceSchema).max(50000),
  dailyBriefs: z.array(DailyBriefSchema).max(8000),
  asOf: DateSchema,
  suggestions: z.array(SuggestionSchema).max(5000).optional(),
  briefCopies: z.array(BriefCopySchema).max(50000).optional(),
  sourceStates: z.array(SourceStateSchema).max(5000).optional(),
  deliveryPlans: z.array(DeliveryPlanSchema).max(10000).optional(),
});
export const QuerySchema = z.object({
  view: z.enum(["projects", "people", "self"]).default("projects"),
  scope: z.string().max(80).default("all"),
  id: z.string().max(80).default("all"),
  tab: z
    .enum(["overview", "progress", "context", "contributions", "suggestions"])
    .default("overview"),
  period: z.enum(["daily", "weekly", "monthly", "yearly"]).default("weekly"),
  date: DateSchema.default("2026-09-09"),
  scenario: z.enum(["normal", "conflict", "delayed"]).default("normal"),
});
export type Query = z.infer<typeof QuerySchema>;
export const BriefNodeSchema = z.strictObject({
  id: Id,
  period: z.enum(["daily", "weekly", "monthly", "yearly"]),
  start: DateSchema,
  end: DateSchema,
  childIds: z.array(Id),
  dailyIds: z.array(Id),
  evidenceIds: z.array(Id),
  changeIds: z.array(Id),
  observedDates: z.array(DateSchema),
  revision: z.string(),
});
export type BriefNode = z.infer<typeof BriefNodeSchema>;
export interface ProjectSnapshot {
  project: Project;
  changes: Change[];
  latest?: Change;
  current: boolean;
}
/** Deterministic facts about a period, computed from children. Copy may narrate them; it cannot contradict them. */
export interface PeriodSlot {
  start: string;
  end: string;
  label: string;
  period: "daily" | "weekly" | "monthly";
  changeIds: string[];
  evidenceIds: string[];
  projectIds: string[];
  headline?: string;
  future: boolean;
}
export interface WorkStream {
  workId: string;
  projectId: string;
  title: string;
  first: { date: string; title: string };
  last: { date: string; title: string; detail: string; basis: Basis };
  changeIds: string[];
  evidenceIds: string[];
  contributorIds: string[];
  openItems: string[];
  nextStep?: { text: string; evidenceId: string };
  dates: string[];
}
export interface MilestoneMove {
  projectId: string;
  milestoneId: string;
  title: string;
  from?: "planned" | "active" | "complete";
  to: "planned" | "active" | "complete";
  target?: string;
}
export interface PeriodDigest {
  unit: "day" | "week" | "month";
  slots: PeriodSlot[];
  streams: WorkStream[];
  milestoneMoves: MilestoneMove[];
  sources: { source: string; count: number }[];
  contributors: { personId: string; changeIds: string[]; projectIds: string[] }[];
  recordedDays: number;
}
export type Basis = z.infer<typeof BasisSchema>;
export interface Dashboard {
  session?: { mode: "demo" | "gateway"; personId: string; synthetic: boolean };
  query: Query;
  workspace: Omit<Workspace, "dailyBriefs" | "suggestions" | "briefCopies">;
  copy?: BriefCopy;
  suggestions: Suggestion[];
  selectedPerson?: Person;
  selectedProject?: Project;
  managedPersonIds: string[];
  visibleProjects: ProjectSnapshot[];
  currentChanges: Change[];
  periodChanges: Change[];
  root: BriefNode;
  lineage: BriefNode[];
  range: { start: string; end: string };
  digest: PeriodDigest;
  notice?: { text: string; evidenceId: string };
  conflict?: {
    headline: string;
    observationIds: string[];
    explanation: string;
  };
}
