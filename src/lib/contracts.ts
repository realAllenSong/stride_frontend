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
}
export const BriefCopySchema = z.strictObject({
  period: z.enum(["daily", "weekly", "monthly", "yearly"]),
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
});
export type BriefCopy = z.infer<typeof BriefCopySchema>;
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
});
export const QuerySchema = z.object({
  view: z.enum(["projects", "people", "self"]).default("projects"),
  scope: z.string().max(80).default("all"),
  id: z.string().max(80).default("all"),
  tab: z
    .enum(["overview", "progress", "contributions", "suggestions"])
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
  notice?: { text: string; evidenceId: string };
  conflict?: {
    headline: string;
    observationIds: string[];
    explanation: string;
  };
}
