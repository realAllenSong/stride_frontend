"use client";
import * as Dialog from "@radix-ui/react-dialog";
import {
  XIcon,
  ShieldCheckIcon,
  FileTextIcon,
  LockSimpleIcon,
  ArrowRightIcon,
  GitBranchIcon,
  InfoIcon,
} from "@phosphor-icons/react";
import type { Dashboard, Evidence, Query } from "@/lib/contracts";
import { shortDate, type Period } from "@/lib/dates";
import { Card, Criterion, TextLink } from "./ui";
import type { RefObject } from "react";

export type Detail =
  | { kind: "milestone"; projectId: string }
  | { kind: "evidence"; ids: string[] }
  | { kind: "record"; id: string }
  | { kind: "sources" | "lineage" | "about" | "goals" };
export type OpenDetail = (detail: Detail) => void;
const basisName = {
  captured: "Captured result",
  source: "Source record",
  reported: "Reported",
};
function EvidenceRecord({
  record,
  open,
}: {
  record: Evidence;
  open: OpenDetail;
}) {
  return (
    <article className="evidence-record">
      <div className="record-meta">
        <span>{record.source}</span>
        <span>{shortDate(record.date, true)}</span>
      </div>
      <h3>{record.title}</h3>
      <span className={`basis ${record.basis}`}>{basisName[record.basis]}</span>
      <p>{record.summary}</p>
      {record.items.length > 0 && (
        <ul className="record-items">
          {record.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
      <p className="record-limitation">
        <InfoIcon size={16} />
        {record.limitation}
      </p>
      {record.restricted && (
        <TextLink onClick={() => open({ kind: "record", id: record.id })}>
          <LockSimpleIcon size={16} />
          Underlying record is restricted
        </TextLink>
      )}
    </article>
  );
}
export function Details({
  detail,
  setDetail,
  data,
  navigate,
  returnFocus,
}: {
  detail: Detail | null;
  setDetail: (detail: Detail | null) => void;
  data: Dashboard;
  navigate: (patch: Partial<Query>) => void;
  returnFocus: RefObject<HTMLElement | null>;
}) {
  const project =
    detail && "projectId" in detail
      ? data.workspace.projects.find((p) => p.id === detail.projectId)
      : data.selectedProject;
  const record =
    detail?.kind === "record"
      ? data.workspace.evidence.find((e) => e.id === detail.id)
      : undefined;
  const titles = {
    milestone: "Milestone evidence",
    evidence: "Supporting records",
    record: record?.restricted
      ? "Underlying record is restricted"
      : (record?.title ?? "Record unavailable"),
    sources: "Sources & freshness",
    lineage: "How this brief was assembled",
    about: "A reference, ready to build on",
    goals: "Project-defined goals",
  };
  const title = detail ? titles[detail.kind] : "Details";
  const records =
    detail?.kind === "evidence"
      ? data.workspace.evidence
          .filter((e) => detail.ids.includes(e.id))
          .sort(
            (a, b) =>
              b.date.localeCompare(a.date) ||
              Number(b.basis === "captured") - Number(a.basis === "captured"),
          )
      : [];
  const scope =
    data.selectedProject?.name ??
    data.selectedPerson?.name ??
    (data.query.scope === "all"
      ? "All groups"
      : data.workspace.groups.find((g) => g.id === data.query.scope)?.name);
  const usedRecords = data.workspace.evidence.filter((e) =>
    data.root.evidenceIds.includes(e.id),
  );
  const used = [...new Set(usedRecords.map((e) => e.source))];
  const states = [
    ...new Map(
      [...(data.workspace.sourceStates ?? [])]
        .sort((a, b) => a.asOf.localeCompare(b.asOf))
        .map((s) => [s.source, s]),
    ).values(),
  ];
  const isDrawer = detail?.kind === "evidence" || detail?.kind === "lineage";
  const availableGoals = data.visibleProjects.filter(
    ({ project }) => project.milestone.configuredAt <= data.range.end,
  );
  return (
    <Dialog.Root
      open={!!detail}
      onOpenChange={(open) => {
        if (!open) setDetail(null);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className={`dialog-content ${isDrawer ? "drawer" : ""} ${record?.restricted ? "compact" : ""}`}
          onCloseAutoFocus={(event) => {
            if (returnFocus.current?.isConnected) {
              event.preventDefault();
              returnFocus.current.focus();
            }
          }}
        >
          <div className="dialog-header">
            <div>
              <p className="dialog-kicker">
                {detail?.kind === "about" ? "STRIDE REFERENCE" : scope}
              </p>
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.Description>
                {detail?.kind === "about"
                  ? data.session?.synthetic !== false
                    ? "Illustrative data. Read-only views. No external connections."
                    : "Approved summaries. Read-only views. Server-enforced access."
                  : `${shortDate(data.range.start)}${data.range.end !== data.range.start ? ` - ${shortDate(data.range.end)}` : ""}, ${data.query.date.slice(0, 4)}`}
              </Dialog.Description>
            </div>
            <Dialog.Close className="icon-button" aria-label="Close details">
              <XIcon size={21} />
            </Dialog.Close>
          </div>
          <div className="dialog-body">
            {detail?.kind === "milestone" &&
              project &&
              project.milestone.configuredAt > data.range.end && (
                <p>
                  No project-defined milestone was configured in this snapshot.
                </p>
              )}
            {detail?.kind === "milestone" &&
              project &&
              project.milestone.configuredAt <= data.range.end && (
                <>
                  <div className="goal-intro">
                    <span className="basis">Project-defined goal</span>
                    <h3>{project.milestone.title}</h3>
                    <p>
                      Configured by the project owner
                      {project.milestone.target
                        ? ` · Target ${shortDate(project.milestone.target)}`
                        : ""}
                    </p>
                  </div>
                  <div className="criteria-list">
                    {project.milestone.criteria.map((c) => {
                      const supporting = data.workspace.evidence
                        .filter(
                          (e) =>
                            e.projectId === project.id && e.criteria?.[c.id],
                        )
                        .sort((a, b) => b.date.localeCompare(a.date))[0];
                      return (
                        <Criterion
                          key={c.id}
                          label={c.label}
                          state={supporting?.criteria?.[c.id] ?? "unknown"}
                          detail={
                            supporting
                              ? `${supporting.title} · ${shortDate(supporting.date)}`
                              : "No matching evidence collected"
                          }
                        />
                      );
                    })}
                  </div>
                  <p className="info-note">
                    <ShieldCheckIcon size={19} />
                    Criteria are supported only within the scope of their
                    evidence. A local check is not a deployment.
                  </p>
                  <TextLink
                    onClick={() =>
                      setDetail({
                        kind: "evidence",
                        ids: data.workspace.evidence
                          .filter((e) => e.projectId === project.id)
                          .map((e) => e.id),
                      })
                    }
                  >
                    View supporting records
                  </TextLink>
                </>
              )}
            {detail?.kind === "evidence" && (
              <>
                {records.length ? (
                  records.map((record) => (
                    <EvidenceRecord
                      key={record.id}
                      record={record}
                      open={setDetail}
                    />
                  ))
                ) : (
                  <p>No matching records are available for this period.</p>
                )}
                <TextLink onClick={() => setDetail({ kind: "sources" })}>
                  Sources & freshness
                </TextLink>
              </>
            )}
            {detail?.kind === "record" &&
              (record ? (
                record.restricted ? (
                  <div className="restricted-record">
                    <span className="empty-symbol">
                      <LockSimpleIcon size={27} />
                    </span>
                    <p>
                      You can read the approved work summary. The underlying
                      session is not included in this shared view.
                    </p>
                    <Card title="Shared summary">
                      <p>{record.summary}</p>
                    </Card>
                    <p className="muted">
                      Raw prompts, responses and private messages are not loaded
                      into this application.
                    </p>
                    <Dialog.Close className="button secondary">
                      Back to summary
                    </Dialog.Close>
                  </div>
                ) : (
                  <EvidenceRecord record={record} open={setDetail} />
                )
              ) : (
                <p>This record is not available in the selected snapshot.</p>
              ))}
            {detail?.kind === "sources" && (
              <>
                <SourceGroup
                  title="Used in this brief"
                  items={used.map((source) => ({
                    name: source,
                    note: shortDate(
                      usedRecords
                        .filter((e) => e.source === source)
                        .sort((a, b) => b.date.localeCompare(a.date))[0].date,
                    ),
                    used: true,
                  }))}
                />
                {!used.length && (
                  <p className="muted">
                    No matching records for the selected scope and period.
                  </p>
                )}
                <SourceGroup
                  title="Connected, no matching records"
                  items={states
                    .filter(
                      (s) =>
                        s.status === "connected" && !used.includes(s.source),
                    )
                    .map((s) => ({
                      name: s.source,
                      note: `No matching records · Checked ${shortDate(s.asOf)}`,
                      used: false,
                    }))}
                />
                <SourceGroup
                  title="Not available in this snapshot"
                  items={states
                    .filter((s) => s.status !== "connected")
                    .map((s) => ({
                      name: s.source,
                      note:
                        s.note ??
                        `${s.status === "delayed" ? "Refresh delayed" : "Unavailable"} · ${shortDate(s.asOf)}`,
                      used: false,
                    }))}
                />
                <p className="info-note">
                  Sources are optional. Missing records do not mean missing
                  work.
                </p>
                <TextLink onClick={() => setDetail({ kind: "lineage" })}>
                  How summaries are grounded
                </TextLink>
              </>
            )}
            {detail?.kind === "lineage" && (
              <>
                <div className="rollup-chain">
                  {["Daily", "Weekly", "Monthly", "Yearly"].map(
                    (label, index) => (
                      <span
                        key={label}
                        className={
                          label.toLowerCase() === data.query.period
                            ? "current"
                            : ""
                        }
                      >
                        {label}
                        {index < 3 && <ArrowRightIcon size={16} />}
                      </span>
                    ),
                  )}
                </div>
                <p className="muted">
                  Each summary is built from the period below it. Original
                  dates, contributors and evidence stay attached.
                </p>
                <Card className="tinted">
                  <h3>
                    {data.root.dailyIds.length} daily{" "}
                    {data.root.dailyIds.length === 1 ? "brief" : "briefs"} in
                    this view
                  </h3>
                  <p>
                    {data.root.observedDates.length
                      ? `Observed ${shortDate(data.root.observedDates[0])} to ${shortDate(data.root.observedDates.at(-1)!)}`
                      : "No collected history in this period."}
                  </p>
                  <p className="small muted">
                    Repeated mentions are grouped by work ID, not counted as
                    additional outcomes.
                  </p>
                </Card>
                <div className="lineage-list">
                  {data.lineage
                    .filter(
                      (n) =>
                        n.period ===
                        (data.query.period === "yearly"
                          ? "monthly"
                          : data.query.period === "monthly"
                            ? "weekly"
                            : "daily"),
                    )
                    .map((n) => (
                      <button
                        key={n.id}
                        className="lineage-row"
                        onClick={() => {
                          setDetail(null);
                          navigate({
                            period: n.period as Period,
                            date: n.start,
                            tab: "progress",
                          });
                        }}
                      >
                        <GitBranchIcon size={20} />
                        <div>
                          <strong>
                            {shortDate(n.start)}
                            {n.start !== n.end ? ` - ${shortDate(n.end)}` : ""}
                          </strong>
                          <span>
                            {n.period} brief · {n.evidenceIds.length} linked
                            records
                          </span>
                        </div>
                        <ArrowRightIcon size={18} />
                      </button>
                    ))}
                </div>
                <details>
                  <summary>Rendering contract</summary>
                  <p>
                    Fixed sections, bounded text fields and source-linked
                    claims. The reference uses an authored dataset and a
                    deterministic reducer, not a live language model.
                  </p>
                  <p>
                    A firm adapter must validate generated JSON, enforce access
                    control and regenerate ancestors when a daily brief is
                    corrected.
                  </p>
                  <a
                    className="text-link"
                    href={`/api/brief?${new URLSearchParams(data.query)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Inspect this JSON response <ArrowRightIcon size={17} />
                  </a>
                </details>
              </>
            )}
            {detail?.kind === "goals" && (
              <div className="goals-list">
                {!availableGoals.length && (
                  <p>
                    No project-defined goals were configured in this snapshot.
                  </p>
                )}
                {availableGoals.map(({ project }) => (
                  <button
                    key={project.id}
                    onClick={() =>
                      setDetail({ kind: "milestone", projectId: project.id })
                    }
                  >
                    <span className="small muted">{project.name}</span>
                    <strong>{project.milestone.title}</strong>
                    <ArrowRightIcon size={19} />
                  </button>
                ))}
              </div>
            )}
            {detail?.kind === "about" && (
              <>
                <p>
                  {data.session?.synthetic !== false
                    ? "This runnable frontend reproduces the approved STRIDE dashboard. Every name, update, note and source record is illustrative."
                    : "This workspace presents approved project updates and their evidence. Your administrator controls which projects and groups are shared with you."}
                </p>
                <div className="about-grid">
                  <Card title="Included">
                    <p>
                      Projects, people, milestones, historical briefs, evidence
                      and read-only suggestions.
                    </p>
                  </Card>
                  <Card
                    title={
                      data.session?.mode === "gateway"
                        ? "Access boundary"
                        : "Not connected"
                    }
                  >
                    <p>
                      {data.session?.mode === "gateway"
                        ? "Identity is verified on the server. Project grants apply to both pages and API responses. Raw private records are not loaded."
                        : "No company systems, credentials, raw sessions, live model or production authorization."}
                    </p>
                  </Card>
                </div>
                {data.session?.mode !== "gateway" && (
                  <details open>
                    <summary>Explore edge cases</summary>
                    <div className="scenario-list">
                      {[
                        { label: "Standard example", scenario: "normal" },
                        {
                          label: "Conflicting source records",
                          scenario: "conflict",
                        },
                        {
                          label: "Delayed GitHub refresh",
                          scenario: "delayed",
                        },
                      ].map((s) => (
                        <button
                          className="button secondary"
                          key={s.scenario}
                          onClick={() => {
                            setDetail(null);
                            navigate({
                              scenario: s.scenario as Query["scenario"],
                              view: "projects",
                              scope: "infra",
                              id: "praetorian",
                              tab: "overview",
                              date: "2026-09-09",
                              period: "daily",
                            });
                          }}
                        >
                          {s.label}
                          <ArrowRightIcon size={16} />
                        </button>
                      ))}
                    </div>
                  </details>
                )}
                <p className="info-note">
                  Manager views show shared progress and support needs, never a
                  productivity score or personal token bill.
                </p>
              </>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
function SourceGroup({
  title,
  items,
}: {
  title: string;
  items: { name: string; note: string; used: boolean }[];
}) {
  if (!items.length) return null;
  return (
    <section className="source-group">
      <h3>{title}</h3>
      {items.map((item) => (
        <div className="source-row" key={item.name}>
          <span className={`source-icon ${item.used ? "used" : ""}`}>
            <FileTextIcon size={19} />
          </span>
          <strong>{item.name}</strong>
          <span>{item.note}</span>
        </div>
      ))}
    </section>
  );
}
