"use client";
import {
  ArrowRightIcon,
  CaretRightIcon,
  CheckIcon,
  FlagIcon,
  GitBranchIcon,
  LinkSimpleIcon,
  ListChecksIcon,
  StackIcon,
} from "@phosphor-icons/react";
import type {
  Dashboard,
  MilestoneMove,
  PeriodSlot,
  Query,
  WorkStream,
} from "@/lib/contracts";
import { periodLabel, shortDate, type Period } from "@/lib/dates";
import type { OpenDetail } from "./dialogs";
import { Avatar, Card, Empty, TextLink } from "./ui";
import { Support } from "./views";

type Props = {
  data: Dashboard;
  open: OpenDetail;
  navigate: (patch: Partial<Query>) => void;
};
const basisName = {
  captured: "Local result",
  source: "Source record",
  reported: "Reported",
};
const childName: Record<Period, string> = {
  daily: "source records",
  weekly: "daily briefs",
  monthly: "weekly briefs",
  yearly: "monthly briefs",
};
const stateName = { planned: "Planned", active: "Current", complete: "Accepted" };

function scopeName(data: Dashboard): string {
  return (
    data.selectedProject?.name ??
    data.selectedPerson?.name.split(" ")[0] ??
    (data.query.scope === "all"
      ? "all projects"
      : data.workspace.groups.find((g) => g.id === data.query.scope)?.name ??
        "this group")
  );
}
function derivedHeadline(data: Dashboard): string {
  const { period, date } = data.query;
  const { streams } = data.digest;
  const projects = new Set(streams.map((s) => s.projectId)).size;
  const updates = data.periodChanges.length;
  if (!updates)
    return period === "daily"
      ? "No records for this day."
      : `No records for this ${period.replace("ly", "")}.`;
  const where =
    projects === 1
      ? data.workspace.projects.find((p) => p.id === streams[0].projectId)
          ?.name
      : `${projects} projects`;
  if (period === "daily")
    return `${updates} ${updates === 1 ? "update" : "updates"} recorded for ${scopeName(data)}.`;
  if (period === "yearly")
    return `${date.slice(0, 4)}: ${streams.length} work ${streams.length === 1 ? "stream" : "streams"} across ${where}.`;
  return `${streams.length} work ${streams.length === 1 ? "stream" : "streams"} moved across ${where} this ${period.replace("ly", "")}.`;
}
function derivedSummary(data: Dashboard): string {
  const { recordedDays, sources } = data.digest;
  if (!data.periodChanges.length)
    return "Missing records are a coverage limit, not evidence of inactivity.";
  const days = `${recordedDays} ${recordedDays === 1 ? "day" : "days"} with shared records`;
  const from = sources.length
    ? ` from ${sources
        .slice(0, 3)
        .map((s) => s.source)
        .join(", ")}${sources.length > 3 ? " and more" : ""}`
    : "";
  return `${days}${from}. Derived from the records below; no generated narrative was supplied for this period.`;
}

export function PeriodBrief(props: Props) {
  const { data } = props;
  const period = data.query.period;
  const headline = data.copy?.headline ?? derivedHeadline(data);
  const summary = data.copy?.summary ?? derivedSummary(data);
  return (
    <div className={`delivery-page brief-page brief-${period}`}>
      <div className="delivery-intro">
        <div>
          <p className="eyebrow">
            {period} brief · {periodLabel(data.query.date, period)}
          </p>
          <h1>{headline}</h1>
          <p className="delivery-objective">{summary}</p>
        </div>
        <div className="plan-stamp">
          <span className={`basis ${data.copy ? "captured" : ""}`}>
            {data.copy ? "Generated copy · sealed" : "Derived from records"}
          </span>
          <span>
            {data.root.dailyIds.length} daily{" "}
            {data.root.dailyIds.length === 1 ? "brief" : "briefs"} ·{" "}
            {data.root.evidenceIds.length} linked records
          </span>
          <span>Built from {childName[period]}</span>
        </div>
      </div>
      {period === "daily" && <DailyTemplate {...props} />}
      {period === "weekly" && <WeeklyTemplate {...props} />}
      {period === "monthly" && <MonthlyTemplate {...props} />}
      {period === "yearly" && <YearlyTemplate {...props} />}
      <footer className="content-footer">
        <TextLink onClick={() => props.open({ kind: "sources" })}>
          Sources & freshness
        </TextLink>
        <button
          className="subtle-link"
          onClick={() => props.open({ kind: "lineage" })}
        >
          <GitBranchIcon size={16} />
          {period === "daily"
            ? "Source-linked brief"
            : `From ${data.root.dailyIds.length} daily ${data.root.dailyIds.length === 1 ? "brief" : "briefs"}`}
        </button>
      </footer>
    </div>
  );
}

/* ---------- shared pieces ---------- */

function CoverageStrip({
  data,
  navigate,
  compact = false,
}: Props & { compact?: boolean }) {
  const { slots, unit } = data.digest;
  const max = Math.max(1, ...slots.map((s) => s.changeIds.length));
  return (
    <section
      className={`coverage-strip ${unit} ${compact ? "compact" : ""}`}
      aria-label={`Records by ${unit}`}
    >
      {slots.map((slot) => (
        <button
          key={slot.start}
          className={`coverage-slot ${slot.future ? "future" : slot.changeIds.length ? "recorded" : "empty"}`}
          aria-label={`${slot.label}: ${slot.future ? "not yet" : `${slot.changeIds.length} updates`}`}
          disabled={slot.future}
          onClick={() =>
            navigate({ period: slot.period, date: slot.start, tab: data.query.tab })
          }
        >
          <span className="coverage-label">{slot.label}</span>
          {unit === "day" && (
            <span className="coverage-date">{slot.start.slice(8)}</span>
          )}
          <span
            className="coverage-bar"
            style={{
              ["--fill" as string]: `${(slot.changeIds.length / max) * 100}%`,
            }}
          />
          <span className="coverage-count">
            {slot.future ? "—" : slot.changeIds.length || "·"}
          </span>
        </button>
      ))}
    </section>
  );
}

function StreamRow({
  data,
  stream,
  open,
  showProject = true,
}: Pick<Props, "data" | "open"> & {
  stream: WorkStream;
  showProject?: boolean;
  navigate?: Props["navigate"];
}) {
  const project = data.workspace.projects.find(
    (p) => p.id === stream.projectId,
  );
  const people = stream.contributorIds
    .map((id) => data.workspace.people.find((p) => p.id === id))
    .filter((p) => !!p);
  return (
    <button
      className="stream-row"
      onClick={() => open({ kind: "evidence", ids: stream.evidenceIds })}
      aria-label={`Open records for ${stream.title}`}
    >
      <span className="stream-main">
        {showProject && project && (
          <span className={`project-tag ${project.color}`}>{project.name}</span>
        )}
        <strong>{stream.last.title}</strong>
        <span className="stream-arc">
          {stream.dates.length > 1 ? (
            <>
              {stream.first.title}
              <ArrowRightIcon size={12} />
              {shortDate(stream.first.date)} – {shortDate(stream.last.date)} ·{" "}
              {stream.changeIds.length} updates
            </>
          ) : (
            <>
              {shortDate(stream.last.date)} · {basisName[stream.last.basis]}
            </>
          )}
        </span>
      </span>
      <span className="stream-side">
        <span className="stream-people">
          {people.slice(0, 3).map((p) => (
            <Avatar key={p.id} initials={p.initials} color={p.color} small />
          ))}
        </span>
        {!!stream.openItems.length && (
          <span className="stream-open">
            {stream.openItems.length} open
          </span>
        )}
        <span className={`basis ${stream.last.basis}`}>
          {basisName[stream.last.basis]}
        </span>
        <CaretRightIcon size={16} />
      </span>
    </button>
  );
}

function MilestoneMoves({
  data,
  moves,
  open,
}: Pick<Props, "data" | "open"> & { moves: MilestoneMove[] }) {
  if (!moves.length) return null;
  return (
    <Card title="Milestone movement" icon={<FlagIcon size={19} />}>
      <div className="move-list">
        {moves.map((m) => {
          const project = data.workspace.projects.find(
            (p) => p.id === m.projectId,
          );
          return (
            <button
              className="move-row"
              key={`${m.projectId}-${m.milestoneId}`}
              onClick={() =>
                open({
                  kind: "delivery-milestone",
                  projectId: m.projectId,
                  id: m.milestoneId,
                })
              }
            >
              {project && !data.selectedProject && (
                <span className={`project-tag ${project.color}`}>
                  {project.name}
                </span>
              )}
              <strong>{m.title}</strong>
              <span className="move-states">
                <span className={`move-state ${m.from ?? "none"}`}>
                  {m.from ? stateName[m.from] : "Introduced"}
                </span>
                <ArrowRightIcon size={13} />
                <span className={`move-state ${m.to}`}>{stateName[m.to]}</span>
              </span>
              {m.target && (
                <span className="move-target">Target {shortDate(m.target)}</span>
              )}
            </button>
          );
        })}
      </div>
      <p className="board-caption">
        Recorded plan states at the start and end of the period. Targets are
        plans, not forecasts.
      </p>
    </Card>
  );
}

function SourceBars({ data }: Pick<Props, "data">) {
  const { sources } = data.digest;
  if (!sources.length) return null;
  const max = sources[0].count;
  return (
    <Card title="Records by source" icon={<StackIcon size={19} />}>
      <div className="source-bars">
        {sources.map((s) => (
          <div className="source-bar" key={s.source}>
            <span>{s.source}</span>
            <span className="source-track">
              <span style={{ width: `${(s.count / max) * 100}%` }} />
            </span>
            <strong>{s.count}</strong>
          </div>
        ))}
      </div>
    </Card>
  );
}

function LineageCard({ data, open }: Pick<Props, "data" | "open">) {
  const period = data.query.period;
  return (
    <Card title="Brief lineage" icon={<GitBranchIcon size={19} />}>
      <h3>
        {period === "daily"
          ? "Every claim links to a record."
          : `Built from ${childName[period]}.`}
      </h3>
      <p>
        {period === "daily"
          ? "The daily brief is the ground truth for every higher-level summary."
          : period === "weekly"
            ? "Seven daily briefs are reduced to one weekly brief. Work streams are grouped by ID, not counted twice."
            : period === "monthly"
              ? "Weekly briefs are reduced to one monthly brief. Month-edge weeks are clipped so days never leak across months."
              : "Monthly briefs are reduced to one yearly brief. Original dates, contributors and evidence stay attached."}
      </p>
      <div className="card-bottom">
        <TextLink onClick={() => open({ kind: "lineage" })}>
          View summary lineage
        </TextLink>
      </div>
    </Card>
  );
}

function OpenItemsCard({ data }: Pick<Props, "data">) {
  const items = [
    ...new Set(data.currentChanges.flatMap((c) => c.openItems)),
  ];
  if (!items.length) return null;
  return (
    <Card className="tinted" title="Still unresolved">
      <ul className="plain-list">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <span className="provenance">From the latest collected records</span>
    </Card>
  );
}

/* ---------- daily ---------- */

function DailyTemplate(props: Props) {
  const { data, open, navigate } = props;
  const changes = data.periodChanges;
  const nextSteps = changes.filter((c) => c.nextStep);
  return (
    <div className="brief-grid">
      <div className="brief-main">
        {changes.length ? (
          <Card title="What changed" icon={<ListChecksIcon size={19} />}>
            <div className="day-changes">
              {changes.map((c) => {
                const project = data.workspace.projects.find(
                  (p) => p.id === c.projectId,
                );
                return (
                  <button
                    className="day-change"
                    key={c.id}
                    onClick={() => open({ kind: "evidence", ids: c.evidenceIds })}
                  >
                    <span className="day-change-head">
                      {project && !data.selectedProject && (
                        <span className={`project-tag ${project.color}`}>
                          {project.name}
                        </span>
                      )}
                      <span className={`basis ${c.basis}`}>
                        {basisName[c.basis]}
                      </span>
                    </span>
                    <strong>{c.title}</strong>
                    <p>{c.detail}</p>
                    <span className="day-change-foot">
                      {c.contributions.map((x) => {
                        const p = data.workspace.people.find(
                          (p) => p.id === x.personId,
                        );
                        return (
                          p && (
                            <span className="day-person" key={x.personId}>
                              <Avatar
                                initials={p.initials}
                                color={p.color}
                                small
                              />
                              {p.name.split(" ")[0]} · {x.description}
                            </span>
                          )
                        );
                      })}
                      <span className="day-records">
                        <LinkSimpleIcon size={14} /> {c.evidenceIds.length}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>
        ) : (
          <Empty title="No records for this day">
            Missing records are not evidence of inactivity. Use the weekly view
            for the surrounding context.
          </Empty>
        )}
        {!!nextSteps.length && (
          <Card title="Next recorded steps">
            {nextSteps.map((c) => (
              <button
                className="linked-task"
                key={c.id}
                onClick={() =>
                  open({ kind: "record", id: c.nextStep!.evidenceId })
                }
              >
                <span>
                  <small>
                    {
                      data.workspace.projects.find((p) => p.id === c.projectId)
                        ?.name
                    }{" "}
                    · Shared note
                  </small>
                  <strong>{c.nextStep!.text}</strong>
                </span>
                <CaretRightIcon size={16} />
              </button>
            ))}
          </Card>
        )}
      </div>
      <aside className="right-rail">
        <OpenItemsCard data={data} />
        <Support data={data} open={open} />
        <SourceBars data={data} />
        <LineageCard data={data} open={open} />
        <TextLink onClick={() => navigate({ period: "weekly" })}>
          See the whole week
        </TextLink>
      </aside>
    </div>
  );
}

/* ---------- weekly ---------- */

function WeeklyTemplate(props: Props) {
  const { data, open } = props;
  const copy = data.copy?.period === "weekly" ? data.copy : undefined;
  const carried =
    copy?.carried.length
      ? copy.carried
      : [...new Set(data.digest.streams.flatMap((s) => s.openItems))];
  return (
    <>
      <CoverageStrip {...props} />
      <div className="brief-grid">
        <div className="brief-main">
          {copy && (
            <section className="theme-grid" aria-label="Themes of the week">
              {copy.themes.map((t, i) => (
                <article className="card theme-card" key={t.title}>
                  <span className="eyebrow">Theme {i + 1}</span>
                  <h2>{t.title}</h2>
                  <p>{t.text}</p>
                  {!!t.evidenceIds.length && (
                    <TextLink
                      onClick={() => open({ kind: "evidence", ids: t.evidenceIds })}
                    >
                      Supporting records
                    </TextLink>
                  )}
                </article>
              ))}
            </section>
          )}
          {data.digest.streams.length ? (
            <Card title="Work streams this week" icon={<StackIcon size={19} />}>
              <div className="stream-list">
                {data.digest.streams.map((s) => (
                  <StreamRow
                    key={`${s.projectId}:${s.workId}`}
                    {...props}
                    stream={s}
                    showProject={!data.selectedProject}
                  />
                ))}
              </div>
            </Card>
          ) : (
            <Empty title="No updates to summarize">
              Missing records are not evidence of inactivity. Try an earlier
              week.
            </Empty>
          )}
          <MilestoneMoves data={data} moves={data.digest.milestoneMoves} open={open} />
        </div>
        <aside className="right-rail">
          {!!carried.length && (
            <Card className="tinted" title="Carried into next week">
              <ul className="plain-list">
                {carried.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <span className="provenance">
                {copy ? "From the generated brief" : "Open items on the latest records"}
              </span>
            </Card>
          )}
          {copy?.outlook && (
            <Card title="Outlook">
              <p>{copy.outlook}</p>
              <span className="provenance">A recorded plan, not a forecast</span>
            </Card>
          )}
          <Support data={data} open={open} />
          <SourceBars data={data} />
          <LineageCard data={data} open={open} />
        </aside>
      </div>
    </>
  );
}

/* ---------- monthly ---------- */

function WeekRows({ data, navigate }: Props) {
  return (
    <div className="week-rows">
      {data.digest.slots.map((slot, i) => (
        <button
          className={`week-row ${slot.future ? "future" : slot.changeIds.length ? "" : "empty"}`}
          key={slot.start}
          disabled={slot.future}
          onClick={() =>
            navigate({ period: "weekly", date: slot.start, tab: data.query.tab })
          }
        >
          <span className="week-index">W{i + 1}</span>
          <span className="week-body">
            <small>{slot.label}</small>
            <strong>
              {slot.future
                ? "Not yet"
                : (slot.headline ??
                  (slot.changeIds.length
                    ? `${slot.changeIds.length} updates across ${slot.projectIds.length} ${slot.projectIds.length === 1 ? "project" : "projects"}`
                    : "No shared records"))}
            </strong>
          </span>
          <span className="week-meta">
            {!slot.future && !!slot.evidenceIds.length && (
              <span>
                <LinkSimpleIcon size={13} /> {slot.evidenceIds.length}
              </span>
            )}
            {!slot.future && <CaretRightIcon size={15} />}
          </span>
        </button>
      ))}
    </div>
  );
}

function MonthlyTemplate(props: Props) {
  const { data, open } = props;
  const copy = data.copy?.period === "monthly" ? data.copy : undefined;
  return (
    <>
      <CoverageStrip {...props} compact />
      <div className="brief-grid">
        <div className="brief-main">
          {copy && (
            <Card className="arc-card" title="How the month moved">
              <p>{copy.arc}</p>
            </Card>
          )}
          <Card title="Week by week" icon={<GitBranchIcon size={19} />}>
            <WeekRows {...props} />
          </Card>
          {!!copy?.decisions.length && (
            <Card title="Decisions recorded" icon={<CheckIcon size={19} />}>
              {copy.decisions.map((d) => (
                <button
                  className="linked-task"
                  key={d.text}
                  onClick={() => open({ kind: "evidence", ids: d.evidenceIds })}
                >
                  <span>
                    <small>Decision · {d.evidenceIds.length} records</small>
                    <strong>{d.text}</strong>
                  </span>
                  <CaretRightIcon size={16} />
                </button>
              ))}
            </Card>
          )}
          <MilestoneMoves data={data} moves={data.digest.milestoneMoves} open={open} />
          {!!data.digest.streams.length && (
            <Card title="Work streams this month" icon={<StackIcon size={19} />}>
              <div className="stream-list">
                {data.digest.streams.map((s) => (
                  <StreamRow
                    key={`${s.projectId}:${s.workId}`}
                    {...props}
                    stream={s}
                    showProject={!data.selectedProject}
                  />
                ))}
              </div>
            </Card>
          )}
        </div>
        <aside className="right-rail">
          {!!copy?.risks.length && (
            <Card className="tinted" title="Risks carried forward">
              <ul className="plain-list">
                {copy.risks.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
              <span className="provenance">From the generated brief</span>
            </Card>
          )}
          {!copy && <OpenItemsCard data={data} />}
          <Support data={data} open={open} />
          <SourceBars data={data} />
          <LineageCard data={data} open={open} />
        </aside>
      </div>
    </>
  );
}

/* ---------- yearly ---------- */

function MonthGrid({ data, navigate }: Props) {
  const max = Math.max(1, ...data.digest.slots.map((s) => s.changeIds.length));
  return (
    <section className="month-grid" aria-label="Records by month">
      {data.digest.slots.map((slot: PeriodSlot) => (
        <button
          key={slot.start}
          className={`month-cell ${slot.future ? "future" : slot.changeIds.length ? "recorded" : "empty"}`}
          disabled={slot.future}
          style={{
            ["--fill" as string]: `${(slot.changeIds.length / max) * 100}%`,
          }}
          onClick={() =>
            navigate({ period: "monthly", date: slot.start, tab: data.query.tab })
          }
        >
          <span className="month-name">{slot.label}</span>
          <strong>
            {slot.future ? "—" : slot.changeIds.length || "·"}
          </strong>
          <small>
            {slot.future
              ? "Not yet"
              : (slot.headline ??
                (slot.changeIds.length
                  ? `${slot.projectIds.length} ${slot.projectIds.length === 1 ? "project" : "projects"}`
                  : "No records"))}
          </small>
        </button>
      ))}
    </section>
  );
}

function YearlyTemplate(props: Props) {
  const { data, open, navigate } = props;
  const copy = data.copy?.period === "yearly" ? data.copy : undefined;
  const projects = [...new Set(data.periodChanges.map((c) => c.projectId))]
    .map((id) => ({
      project: data.workspace.projects.find((p) => p.id === id)!,
      count: data.periodChanges.filter((c) => c.projectId === id).length,
    }))
    .filter((x) => x.project)
    .sort((a, b) => b.count - a.count);
  const quarters = [1, 2, 3, 4].map((q) => ({
    q,
    copy: copy?.quarters.find((x) => x.quarter === q),
    slots: data.digest.slots.slice((q - 1) * 3, q * 3),
  }));
  return (
    <>
      <MonthGrid {...props} />
      <div className="brief-grid">
        <div className="brief-main">
          <section className="quarter-grid" aria-label="Quarter by quarter">
            {quarters.map(({ q, copy: qc, slots }) => {
              const count = slots.reduce((n, s) => n + s.changeIds.length, 0);
              const future = slots.every((s) => s.future);
              return (
                <article
                  className={`card quarter-card ${future ? "future" : count ? "" : "empty"}`}
                  key={q}
                >
                  <span className="eyebrow">Q{q}</span>
                  <h2>
                    {qc?.headline ??
                      (future ? "Not yet" : count ? `${count} updates` : "No records")}
                  </h2>
                  <p>
                    {qc?.text ??
                      (future
                        ? "This quarter has not started in the snapshot."
                        : count
                          ? "No generated narrative for this quarter. Open a month for details."
                          : "Missing records are not evidence of inactivity.")}
                  </p>
                </article>
              );
            })}
          </section>
          <MilestoneMoves data={data} moves={data.digest.milestoneMoves} open={open} />
          {!!data.digest.streams.length && (
            <Card title="Work streams this year" icon={<StackIcon size={19} />}>
              <div className="stream-list">
                {data.digest.streams.map((s) => (
                  <StreamRow
                    key={`${s.projectId}:${s.workId}`}
                    {...props}
                    stream={s}
                    showProject={!data.selectedProject}
                  />
                ))}
              </div>
            </Card>
          )}
        </div>
        <aside className="right-rail">
          {!!projects.length && !data.selectedProject && (
            <Card title="Projects touched">
              <div className="project-chips">
                {projects.map(({ project, count }) => (
                  <button
                    className="project-chip"
                    key={project.id}
                    onClick={() =>
                      navigate({
                        view: "projects",
                        id: project.id,
                        scope: project.groupId,
                        tab: "progress",
                      })
                    }
                  >
                    <Avatar initials={project.initials} color={project.color} small />
                    <span>
                      <strong>{project.name}</strong>
                      <small>{count} updates</small>
                    </span>
                  </button>
                ))}
              </div>
            </Card>
          )}
          {!!copy?.lessons.length && (
            <Card className="tinted" title="Lessons recorded">
              <ul className="plain-list">
                {copy.lessons.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
              <span className="provenance">From the generated brief</span>
            </Card>
          )}
          <SourceBars data={data} />
          <LineageCard data={data} open={open} />
        </aside>
      </div>
    </>
  );
}
