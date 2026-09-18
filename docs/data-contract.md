# Data contract and adapter handoff

## Boundary

`BriefRepository.readWorkspace(): Promise<Workspace>` is the server-only input seam in `src/lib/provider.ts`. Both the server-rendered page and `GET /api/brief` use it. Replace the demo repository, not the React templates.

`loadDashboard` verifies the gateway principal, reads a bounded approved snapshot and applies `authorizeWorkspace` before building or serializing the view. Do not trust `view=self`, a person ID or a group query parameter. Query filtering in `buildDashboard` is presentation logic; server-owned grants are the security boundary. The file adapter requires gateway mode for external data. See [deployment](deployment.md).

## Inputs

| Input                                | Source of truth                          | Important rules                                                        |
| ------------------------------------ | ---------------------------------------- | ---------------------------------------------------------------------- |
| Groups, people, reporting tree       | Directory adapter                        | Stable IDs; no inferred reporting relationships                        |
| Projects, owners, milestone criteria | Configured project context               | Goals and dates are not inferred from an agent's narration             |
| Evidence                             | Approved source projections              | Source, date, basis, limitation and optional criterion observations    |
| Daily briefs                         | Daily generation service                 | One workspace brief per date, containing attributed project work items |
| Period copy                          | Weekly/monthly/yearly generation service | Bound to an exact subject, window and child-node set                   |
| Suggestions                          | Personal coaching service                | Separate authorization; no manager-visible private payload             |

Available sources may differ by person and date. Personal notes are first-class evidence but remain **reported**. A source need not exist to render a usable page.

`Evidence.source` accepts a bounded source name, including custom adapters. Optional `sourceStates` supply `source`, `status` (`connected`, `unavailable`, `delayed`), `asOf`, optional `note` and `projectIds`. The dialog uses this dated metadata; it never infers a connected service from missing events. When no connection metadata is available, only observed sources are listed.

## Validated shapes

Executable schemas are in `src/lib/contracts.ts`; they are authoritative. `DailyBriefSchema`, `ChangeSchema`, `EvidenceSchema`, `BriefCopySchema` and `SuggestionSchema` use strict objects. Unknown generated fields are rejected.

- Brief schema version: `1.0`.
- Dates: real ISO calendar dates, 2000–2100. Date-only period calculations use UTC for deterministic rendering; define the employee/workspace reporting timezone upstream.
- Titles/headlines: up to 120 characters. Supporting copy: up to 420 characters. Prefer considerably shorter copy.
- `workId` identifies a continuing workstream; `id` identifies an individual dated update. Keep `workId` stable across updates.
- Every change has at least one `evidenceId`. Its evidence must belong to the same project and cannot be dated after the change.
- `basis`: `captured` is an observed result within its stated scope; `source` is a native source record; `reported` is narration or a note. These are not confidence or performance scores.
- `contributions` names original contributors and what each did. A reporting relationship does not change that attribution.
- `facts`, `checkpoints`, `nextStep`, `support` and `noteEvidenceId` are optional slots. Their references must be included in the change's evidence IDs. Omit unsupported slots.
- Milestone criteria use `met`, `not-met` or `unknown`, grounded in matching evidence. A local test is not deployment evidence.

The repository validates schemas and cross-record references before rendering. Validation guarantees structure and referential consistency, **not factual truth**. The generation service still needs grounding evaluation and conflict detection.

## Hierarchical aggregation

1. Build daily nodes from permitted daily changes.
2. A weekly node consumes its daily children; weeks start Monday.
3. A monthly node consumes weekly children **clipped to the month**.
4. A yearly node consumes monthly children.
5. Each node retains `childIds`, `dailyIds`, `evidenceIds`, `changeIds`, `observedDates` and a SHA-256 `revision` of its inputs.
6. The UI groups repeated mentions by `(projectId, workId)`, selecting the latest state. Historical changes remain available in progress and lineage.

Month-edge clipping is deliberate: September's first weekly segment is September 1–6, not August 31–September 6. Opening a week in the calendar navigates to the full Monday–Sunday view; the original monthly lineage still retains its clipped segment. Do not import a prewritten cross-month weekly narrative wholesale into a monthly brief. Produce an in-window child projection first.

Periods with only partial collected history remain partial. No missing days are synthesized. A last-known update may be shown with its original date, but it is not relabeled as today's achievement. Future windows contain no invented work.

## Generated copy

`BriefCopy` contains:

```json
{
  "period": "monthly",
  "start": "2026-09-01",
  "end": "2026-09-30",
  "subject": { "kind": "projects", "id": "praetorian" },
  "headline": "Retry recovery reached local validation.",
  "summary": "Two local checks remain unresolved. The latest collected pull request is still open.",
  "childIds": ["weekly:2026-09-01:2026-09-06", "weekly:2026-09-07:2026-09-13"],
  "evidenceIds": ["run-184", "pr-297"]
}
```

The example exists in the fixture and appears in the monthly Praetorian view. A generation job must also copy the root's `revision` into `sourceRevision`. Copy is selected only when its subject, period, bounds, source revision and complete child-ID set match the current root, and its evidence is in that root. Missing or stale revisions use a neutral deterministic fallback. The fixture seals its authored example during initialization; a real adapter must persist the revision actually consumed by generation, never automatically reseal stale prose.

Use `subject.id = "group:<groupId>"` for a portfolio and `"group:all"` for all groups. Individual person and project subjects use their entity IDs. The daily project heading can also come from a change's `headline` / `subheading`.

The model must never generate components, CSS, HTML or arbitrary route names. Text is rendered as escaped React text, not executable markup. The fixed templates control section order, whitespace, typography, expansion and mobile behavior.

## Corrections and versions

This frontend does not persist generations, call an LLM or schedule refreshes. It hashes daily changes plus referenced evidence and recursively hashes child revisions; corrected child content invalidates old parent copy even when IDs do not change. The file adapter reads each request's snapshot and accepts atomic replacements without a restart. Generation metadata, correction history, regeneration jobs and storage retention belong behind the adapter.

When an approved daily brief or its evidence changes, rebuild the affected weekly projections, then monthly and yearly copies. Revalidate evidence and retain correction history according to retention policy. Permissions changes and deletions must propagate to all derived views, not just the raw store.

## Manager scope

The reporting tree selects the manager plus descendants, guarded against cycles. The person view separates `Own contributions` from `Team outcomes`; a work item is not duplicated between those two lists. Original contributors remain visible. No volume total, token spend, relative ranking or aggregate personal rating is calculated.

## Integration checklist

1. Supply a small approved `Workspace` fixture from the firm adapter and run reference/schema validation.
2. Add contract tests for real formats, access scope, redaction, missing records and contradictory evidence.
3. Connect a constrained structured-output generator using the instructions in `generation-prompt.md`.
4. Evaluate unsupported-claim rate, evidence-link precision, attribution fidelity and abstention on sparse inputs.
5. Supply dated source states and verified identity grants. Production mode rejects fixture scenario overrides and isolates private coaching to the current subject.
6. Keep the frontend read-only until separate write workflows are deliberately designed and authorized.
