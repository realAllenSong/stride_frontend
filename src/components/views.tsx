"use client";
import {
  ArrowRightIcon,
  CaretRightIcon,
  UsersThreeIcon,
  CalendarBlankIcon,
  FileTextIcon,
  LinkSimpleIcon,
  GitPullRequestIcon,
  CubeIcon,
  CheckIcon,
  InfoIcon,
  LockSimpleIcon,
  GitBranchIcon,
} from "@phosphor-icons/react";
import type {
  Dashboard,
  Query,
  Change,
  ProjectSnapshot,
} from "@/lib/contracts";
import { shortDate } from "@/lib/dates";
import { latestPerWork } from "@/lib/work";
import { Avatar, Card, Empty, TextLink } from "./ui";
import type { OpenDetail } from "./dialogs";
type Props = {
  data: Dashboard;
  open: OpenDetail;
  navigate: (patch: Partial<Query>) => void;
};
const basis = {
  captured: "Local result",
  source: "Source record",
  reported: "Reported",
};
const periodName = {
  daily: "Today",
  weekly: "This week",
  monthly: "This month",
  yearly: "This year",
};
function when(data: Dashboard): string {
  return data.query.date === data.workspace.asOf
    ? periodName[data.query.period]
    : {
        daily: "This day",
        weekly: "This week",
        monthly: "This month",
        yearly: "This year",
      }[data.query.period];
}
export function Provenance({ change }: { change: Change }) {
  return (
    <span className="provenance">
      {basis[change.basis]} · {shortDate(change.date)}
    </span>
  );
}
export function ScopeFooter({ data, open }: Pick<Props, "data" | "open">) {
  return (
    <footer className="content-footer">
      <TextLink onClick={() => open({ kind: "sources" })}>
        Sources & freshness
      </TextLink>
      <button className="subtle-link" onClick={() => open({ kind: "lineage" })}>
        <GitBranchIcon size={16} />
        {data.query.period === "daily"
          ? "Source-linked brief"
          : `From ${data.root.dailyIds.length} daily ${data.root.dailyIds.length === 1 ? "brief" : "briefs"}`}
      </button>
    </footer>
  );
}
export function Portfolio({ data, open, navigate }: Props) {
  const groups = data.workspace.groups.filter(
    (g) => data.query.scope === "all" || g.id === data.query.scope,
  );
  return (
    <>
      <div className="main-grid portfolio-grid">
        <div className="main-column">
          <div className="page-intro">
            <h1>{data.copy?.headline ?? `${when(data)}, across projects.`}</h1>
            <p>
              {data.copy?.summary ??
                "Updates from available records and team notes."}
            </p>
          </div>
          <h2 className="section-title">Projects</h2>
          {groups.map((group) => (
            <section className="card project-group" key={group.id}>
              <h3 className="group-label">{group.name}</h3>
              {data.visibleProjects
                .filter((p) => p.project.groupId === group.id)
                .map((snapshot) => (
                  <ProjectRow
                    key={snapshot.project.id}
                    snapshot={snapshot}
                    onClick={() =>
                      navigate({
                        id: snapshot.project.id,
                        scope: group.id,
                        tab: "overview",
                      })
                    }
                  />
                ))}
            </section>
          ))}
          <ScopeFooter data={data} open={open} />
        </div>
        <aside className="right-rail">
          <Support data={data} open={open} />
          <Card title="Milestones" icon={<CalendarBlankIcon size={22} />}>
            <h3>Goals set by project owners</h3>
            <div className="card-bottom">
              <TextLink onClick={() => open({ kind: "goals" })}>
                View project context
              </TextLink>
            </div>
          </Card>
        </aside>
      </div>
    </>
  );
}
function ProjectRow({
  snapshot,
  onClick,
}: {
  snapshot: ProjectSnapshot;
  onClick: () => void;
}) {
  const { project, latest, current } = snapshot;
  return (
    <button
      className="project-row"
      onClick={onClick}
      aria-label={`Open ${project.name}`}
    >
      <Avatar initials={project.initials} color={project.color} />
      <div className="project-identity">
        <strong>{project.name}</strong>
        <span>{project.purpose}</span>
      </div>
      <div className="project-summary">
        <strong>
          {current ? latest?.title : "No new update in this period"}
        </strong>
        <span>
          {current
            ? latest?.detail
            : latest
              ? `Last record ${shortDate(latest.date)}`
              : "No collected history yet"}
        </span>
      </div>
      <div className="project-source">
        {current && latest && <Provenance change={latest} />}
      </div>
      <CaretRightIcon size={19} />
    </button>
  );
}
export function Support({ data, open }: Pick<Props, "data" | "open">) {
  const requests = data.currentChanges.filter((c) => c.support);
  if (!requests.length) return null;
  return (
    <Card
      className="tinted"
      title="Support requested"
      icon={<UsersThreeIcon size={23} />}
    >
      {requests.map((c) => (
        <div key={c.id}>
          <h3>{c.support!.text}</h3>
          <p>
            {data.workspace.projects.find((p) => p.id === c.projectId)?.name} ·
            Shared note
          </p>
          <div className="card-bottom">
            <TextLink
              onClick={() =>
                open({ kind: "record", id: c.support!.evidenceId })
              }
            >
              View context
            </TextLink>
          </div>
        </div>
      ))}
    </Card>
  );
}
export function ProjectView({ data, open, navigate }: Props) {
  const snapshot = data.visibleProjects[0];
  if (!snapshot)
    return (
      <Empty title="Project not available">
        Choose a project in the sidebar.
      </Empty>
    );
  const { project, latest, current } = snapshot;
  const milestoneAvailable = project.milestone.configuredAt <= data.range.end;
  if (data.query.tab === "progress")
    return <Progress data={data} open={open} navigate={navigate} />;
  if (!current)
    return (
      <div className="main-grid">
        <div className="main-column">
          <div className="page-intro">
            <h1>No new update for this period.</h1>
            <p>
              {latest
                ? `The latest available record is from ${shortDate(latest.date)}.`
                : "No collected history is available yet."}
            </p>
          </div>
          <Card
            title={
              latest
                ? `Last known update · ${shortDate(latest.date)}`
                : "Available history"
            }
          >
            {latest ? (
              <>
                <h2>{latest.title}</h2>
                <p>{latest.detail}</p>
                <p className="muted">
                  Current progress is not established by this snapshot.
                </p>
                <TextLink
                  onClick={() =>
                    navigate({ date: latest.date, period: "daily" })
                  }
                >
                  View {shortDate(latest.date)}
                </TextLink>
              </>
            ) : (
              <p>
                There are no records to summarize. This is a coverage limit, not
                a record of inactivity.
              </p>
            )}
          </Card>
          <ScopeFooter data={data} open={open} />
        </div>
        <aside className="right-rail">
          <Card title="Available context">
            <p>No matching records for this period.</p>
            <TextLink onClick={() => open({ kind: "sources" })}>
              Sources & freshness
            </TextLink>
          </Card>
        </aside>
      </div>
    );
  const conflict = data.conflict;
  const headline =
    conflict?.headline ??
    data.copy?.headline ??
    latest?.headline ??
    latest?.title;
  return (
    <>
      {data.notice && (
        <div className="context-banner">
          <InfoIcon size={18} />
          <span>{data.notice.text}</span>
          <TextLink
            icon={false}
            onClick={() =>
              open({ kind: "record", id: data.notice!.evidenceId })
            }
          >
            Details
          </TextLink>
        </div>
      )}
      <div className="main-grid">
        <div className="main-column">
          <div className="page-intro">
            <h1>{headline}</h1>
            <p>{data.copy?.summary ?? latest?.subheading ?? latest?.detail}</p>
          </div>
          {conflict && (
            <Card title="Source observations">
              <div className="comparison">
                {conflict.observationIds
                  .map((id) => data.workspace.evidence.find((e) => e.id === id))
                  .filter((e) => !!e)
                  .map((record) => (
                    <div key={record.id}>
                      <span className={`basis ${record.basis}`}>
                        {basis[record.basis]}
                      </span>
                      <h3>{record.summary}</h3>
                      <p>
                        {record.title} · {shortDate(record.date)}
                      </p>
                    </div>
                  ))}
              </div>
              <p className="info-note">{conflict.explanation}</p>
              <TextLink
                onClick={() =>
                  open({ kind: "evidence", ids: conflict.observationIds })
                }
              >
                Compare supporting records
              </TextLink>
            </Card>
          )}
          {milestoneAvailable && (
            <Card title="Current milestone">
              <h2>{project.milestone.title}</h2>
              <p className="muted">
                Project-defined goal
                {project.milestone.target
                  ? ` · Target ${shortDate(project.milestone.target)}`
                  : ""}
              </p>
              {!!latest?.openItems.length && (
                <div className="open-items">
                  <h3>Open items</h3>
                  {latest.openItems.map((item) => (
                    <p key={item}>
                      <span className="open-circle" />
                      {item}
                    </p>
                  ))}
                </div>
              )}
              {!!latest?.checkpoints?.length && (
                <div className="test-stages">
                  {latest.checkpoints.map((s, index) => (
                    <span key={s.label}>
                      <CheckIcon size={19} />
                      {s.label}
                      {index < latest.checkpoints!.length - 1 && (
                        <ArrowRightIcon size={15} />
                      )}
                    </span>
                  ))}
                </div>
              )}
              <div className="card-bottom">
                <TextLink
                  onClick={() =>
                    open({ kind: "milestone", projectId: project.id })
                  }
                >
                  View milestone evidence
                </TextLink>
              </div>
            </Card>
          )}
          {latest?.noteEvidenceId ? (
            <Card title="Shared note">
              <p className="shared-note">
                {
                  data.workspace.evidence.find(
                    (e) => e.id === latest.noteEvidenceId,
                  )?.summary
                }
              </p>
              <span className="provenance">
                Personal update · {shortDate(latest!.date)}
              </span>
              <div className="card-bottom">
                <TextLink
                  onClick={() =>
                    open({
                      kind: "record",
                      id: latest.noteEvidenceId!,
                    })
                  }
                >
                  View note context
                </TextLink>
              </div>
            </Card>
          ) : (
            <Card title="What changed">
              <div className="contribution-list">
                {snapshot.changes.flatMap((c) =>
                  c.contributions.map((contribution, i) => {
                    const person = data.workspace.people.find(
                      (p) => p.id === contribution.personId,
                    )!;
                    return (
                      <button
                        className="contribution-row"
                        key={`${c.id}-${i}`}
                        onClick={() =>
                          navigate({
                            view: "people",
                            id: person.id,
                            scope: "all",
                            tab: "overview",
                          })
                        }
                      >
                        <Avatar
                          initials={person.initials}
                          color={person.color}
                          small
                        />
                        <strong>{person.name}</strong>
                        <div>
                          {contribution.description}
                          <span className="provenance">
                            {basis[contribution.basis]} · {shortDate(c.date)}
                          </span>
                        </div>
                        <CaretRightIcon size={16} />
                      </button>
                    );
                  }),
                )}
              </div>
              <div className="card-bottom">
                <TextLink
                  onClick={() =>
                    open({
                      kind: "evidence",
                      ids: snapshot.changes.flatMap((c) => c.evidenceIds),
                    })
                  }
                >
                  <LinkSimpleIcon size={20} />
                  View supporting records
                </TextLink>
              </div>
            </Card>
          )}
          <ScopeFooter data={data} open={open} />
        </div>
        <aside className="right-rail">
          {latest?.facts?.length ? (
            <Card title="Latest evidence" icon={<FileTextIcon size={23} />}>
              <div className="fact-list">
                {latest.facts.map((f) => (
                  <Fact
                    key={f.label}
                    icon={
                      f.kind === "result" ? (
                        <CheckIcon size={22} />
                      ) : f.kind === "repository" ? (
                        <GitPullRequestIcon size={22} />
                      ) : (
                        <CubeIcon size={22} />
                      )
                    }
                    title={f.label}
                    note={f.context}
                  />
                ))}
              </div>
              <div className="card-bottom">
                <TextLink
                  onClick={() =>
                    open({
                      kind: "evidence",
                      ids: latest.facts!.flatMap((f) =>
                        f.evidenceId ? [f.evidenceId] : [],
                      ),
                    })
                  }
                >
                  View evidence details
                </TextLink>
              </div>
            </Card>
          ) : (
            <Support data={data} open={open} />
          )}
          {latest?.nextStep && (
            <Card
              title="Next recorded step"
              icon={<CalendarBlankIcon size={22} />}
            >
              <h3>{latest.nextStep.text}</h3>
              <p>Shared note · {shortDate(latest.date)}</p>
              <div className="card-bottom">
                <TextLink
                  onClick={() =>
                    open({ kind: "record", id: latest.nextStep!.evidenceId })
                  }
                >
                  View note
                </TextLink>
              </div>
            </Card>
          )}
          {!latest?.facts?.length && (
            <Card title="Available context" icon={<FileTextIcon size={22} />}>
              <p>
                {latest?.basis === "reported"
                  ? "Reported work. No independent result has been verified."
                  : "Local test output. Deployment has not been verified."}
              </p>
              <TextLink
                onClick={() =>
                  open({ kind: "evidence", ids: latest?.evidenceIds ?? [] })
                }
              >
                View supporting records
              </TextLink>
            </Card>
          )}
        </aside>
      </div>
    </>
  );
}
function Fact({
  icon,
  title,
  note,
}: {
  icon: React.ReactNode;
  title: string;
  note: string;
}) {
  return (
    <div className="fact">
      <span className="fact-icon">{icon}</span>
      <div>
        <strong>{title}</strong>
        <span>{note}</span>
      </div>
    </div>
  );
}

export function PeopleDirectory({ data, open, navigate }: Props) {
  const people = data.workspace.people.filter(
    (p) => data.query.scope === "all" || p.groupId === data.query.scope,
  );
  return (
    <>
      <div className="page-intro">
        <h1>Shared work, person by person.</h1>
        <p>Contributions in context, without activity rankings.</p>
      </div>
      <div className="people-directory">
        {people.map((person) => {
          const contributions = data.currentChanges.filter((c) =>
            c.contributions.some((x) => x.personId === person.id),
          );
          return (
            <button
              className="card person-tile"
              key={person.id}
              onClick={() =>
                navigate({ view: "people", id: person.id, tab: "overview" })
              }
            >
              <div className="person-tile-header">
                <Avatar initials={person.initials} color={person.color} />
                <div>
                  <h2>{person.name}</h2>
                  <span>{person.role}</span>
                </div>
                <CaretRightIcon size={20} />
              </div>
              <p>
                {contributions[0]?.contributions.find(
                  (c) => c.personId === person.id,
                )?.description ?? "No shared update in this period"}
              </p>
              <span className="provenance">
                {contributions.length
                  ? [
                      ...new Set(
                        contributions.map(
                          (c) =>
                            data.workspace.projects.find(
                              (p) => p.id === c.projectId,
                            )?.name,
                        ),
                      ),
                    ].join(", ")
                  : "Available records only"}
              </span>
            </button>
          );
        })}
      </div>
      <ScopeFooter data={data} open={open} />
    </>
  );
}
export function PersonView({ data, open, navigate }: Props) {
  const person = data.selectedPerson!;
  const own = data.currentChanges.filter((c) =>
    c.contributions.some((x) => x.personId === person.id),
  );
  const team = data.currentChanges.filter(
    (c) =>
      c.contributions.some((x) => data.managedPersonIds.includes(x.personId)) &&
      !own.some((x) => x.id === c.id),
  );
  const isManager = data.managedPersonIds.length > 0;
  if (data.query.tab === "progress")
    return <Progress data={data} open={open} navigate={navigate} />;
  if (data.query.view === "self" && data.query.tab === "suggestions")
    return <Suggestions data={data} open={open} />;
  const contributionView = data.query.tab === "contributions";
  return (
    <div className="main-grid">
      <div className="main-column">
        <div className="page-intro">
          <h1>
            {data.copy?.headline ??
              (contributionView
                ? "Contributions to shared work."
                : isManager
                  ? "Your work. Your team’s progress."
                  : `${when(data)}’s work.`)}
          </h1>
          <p>
            {data.copy?.summary ??
              (isManager
                ? "Personal contributions and team outcomes, with attribution."
                : [
                    ...new Set(
                      data.currentChanges.map(
                        (c) =>
                          data.workspace.projects.find(
                            (p) => p.id === c.projectId,
                          )?.name,
                      ),
                    ),
                  ].join(" and ") || "The available record for this period.")}
          </p>
        </div>
        {!own.length && (
          <Empty title="No shared update in this period">
            <p>
              There may be work outside the collected records. No performance
              conclusion is drawn.
            </p>
          </Empty>
        )}
        {isManager && !!own.length && (
          <h2 className="section-title">Own contributions</h2>
        )}
        {own.map((c) => (
          <ContributionCard
            key={c.id}
            data={data}
            change={c}
            open={open}
            navigate={navigate}
            expanded={contributionView}
          />
        ))}
        {isManager && (
          <>
            <div className="section-heading">
              <h2 className="section-title">Team outcomes</h2>
              <span className="small muted">Contributors remain named</span>
            </div>
            {team.length ? (
              team.map((c) => (
                <ContributionCard
                  key={c.id}
                  data={data}
                  change={c}
                  open={open}
                  navigate={navigate}
                  expanded
                />
              ))
            ) : (
              <Empty title="No team updates in this period">
                No collected records are available for this reporting scope.
              </Empty>
            )}
          </>
        )}
        <ScopeFooter data={data} open={open} />
      </div>
      <aside className="right-rail">
        <Support data={data} open={open} />
        <Card title="Available context" icon={<FileTextIcon size={22} />}>
          <p>
            {data.root.evidenceIds.length
              ? "Shared notes and linked source records for the selected period."
              : "No matching source records in this period."}
          </p>
          <TextLink onClick={() => open({ kind: "sources" })}>
            Sources & freshness
          </TextLink>
        </Card>
        {isManager && (
          <Card title="Team attribution">
            <p>
              Team progress appears in your scope. It remains the shared work of
              the original contributors.
            </p>
            <p className="small muted">
              No individual scores or allocation of credit.
            </p>
          </Card>
        )}
      </aside>
    </div>
  );
}
function ContributionCard({
  data,
  change,
  open,
  navigate,
  expanded,
}: Props & { change: Change; expanded: boolean }) {
  const project = data.workspace.projects.find(
    (p) => p.id === change.projectId,
  )!;
  return (
    <Card className="work-card">
      <div className="work-card-heading">
        <span className={`project-tag ${project.color}`}>{project.name}</span>
        <button
          className="icon-button"
          aria-label={`Open project ${project.name}`}
          onClick={() =>
            navigate({
              view: "projects",
              id: project.id,
              scope: project.groupId,
              tab: "overview",
            })
          }
        >
          <CaretRightIcon size={22} />
        </button>
      </div>
      <h2>{change.title}</h2>
      <p>{change.detail}</p>
      {expanded && (
        <div className="attribution-lines">
          {change.contributions.map((c) => (
            <p key={c.personId}>
              <strong>
                {data.workspace.people.find((p) => p.id === c.personId)?.name}:
              </strong>{" "}
              {c.description}
              <span className="provenance">{basis[c.basis]}</span>
            </p>
          ))}
        </div>
      )}
      {change.value && (
        <div className="value-line">
          <span>Intended value</span>
          <p>{change.value}</p>
        </div>
      )}
      <div className="card-bottom">
        <TextLink
          onClick={() => open({ kind: "evidence", ids: change.evidenceIds })}
        >
          <LinkSimpleIcon size={20} />
          {change.basis === "reported"
            ? "View reported context"
            : "View supporting records"}
        </TextLink>
        <Provenance change={change} />
      </div>
    </Card>
  );
}
export function Progress({ data, open, navigate }: Props) {
  const childGrain = {
    daily: "daily",
    weekly: "daily",
    monthly: "weekly",
    yearly: "monthly",
  }[data.query.period];
  const nodes = data.lineage.filter((n) => n.period === childGrain);
  const heading =
    data.query.period === "yearly"
      ? `${data.query.date.slice(0, 4)} · available history`
      : `${when(data)}’s changes.`;
  return (
    <div className="main-grid">
      <div className="main-column">
        <div className="page-intro">
          <h1>{data.copy?.headline ?? heading}</h1>
          <p>
            {data.copy?.summary ??
              (data.root.observedDates.length
                ? `Records from ${shortDate(data.root.observedDates[0])} to ${shortDate(data.root.observedDates.at(-1)!)}.`
                : "No collected history for this period.")}
          </p>
        </div>
        {nodes.length ? (
          <Card title="Recorded changes">
            <div className="timeline">
              {nodes.map((node) => {
                const changes = latestPerWork(
                  data.periodChanges.filter((c) =>
                    node.changeIds.includes(c.id),
                  ),
                );
                return (
                  <article className="timeline-entry" key={node.id}>
                    <div className="timeline-date">
                      {shortDate(node.start)}
                      {node.end !== node.start && (
                        <span>to {shortDate(node.end)}</span>
                      )}
                    </div>
                    <div className="timeline-content">
                      {changes.map((change) => (
                        <button
                          key={change.id}
                          className="timeline-change"
                          onClick={() =>
                            open({ kind: "evidence", ids: change.evidenceIds })
                          }
                        >
                          <strong>{change.title}</strong>
                          <span>
                            {data.selectedProject
                              ? basis[change.basis]
                              : data.workspace.projects.find(
                                  (p) => p.id === change.projectId,
                                )?.name}
                          </span>
                          <CaretRightIcon size={17} />
                        </button>
                      ))}
                      {node.period !== "daily" && (
                        <TextLink
                          onClick={() =>
                            navigate({
                              date: node.start,
                              period: node.period,
                              tab: "progress",
                            })
                          }
                        >
                          Read {node.period} brief
                        </TextLink>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </Card>
        ) : (
          <Empty title="No updates to summarize">
            Missing records are not evidence of inactivity. Try an earlier date.
          </Empty>
        )}
        <ScopeFooter data={data} open={open} />
      </div>
      <aside className="right-rail">
        <Support data={data} open={open} />
        {!!data.currentChanges.flatMap((c) => c.openItems).length && (
          <Card className="tinted" title="Still unresolved">
            <ul className="plain-list">
              {[
                ...new Set(data.currentChanges.flatMap((c) => c.openItems)),
              ].map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <span className="provenance">
              From the latest collected records
            </span>
          </Card>
        )}
        <Card title="Brief history" icon={<GitBranchIcon size={22} />}>
          <h3>One traceable story.</h3>
          <p>
            {data.query.period === "daily"
              ? "Each claim links back to its supporting record."
              : `${data.query.period[0].toUpperCase() + data.query.period.slice(1)} briefs build on ${childGrain} briefs.`}
          </p>
          <div className="card-bottom">
            <TextLink onClick={() => open({ kind: "lineage" })}>
              View summary lineage
            </TextLink>
          </div>
        </Card>
      </aside>
    </div>
  );
}
function Suggestions({ data, open }: Pick<Props, "data" | "open">) {
  const suggestion = data.suggestions[0];
  return (
    <div className="main-grid">
      <div className="main-column">
        <div className="page-intro">
          <h1>
            {suggestion
              ? "One idea for your next review."
              : "No suggestion for this period."}
          </h1>
          <p>Optional guidance, separate from your shared work.</p>
        </div>
        {suggestion ? (
          <Card title="Suggested workflow">
            <h2>{suggestion.title}</h2>
            <p>{suggestion.reason}</p>
            <ol className="suggestion-list">
              {suggestion.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <p className="muted small">
              A suggestion, not a recorded commitment.
            </p>
            <div className="card-bottom">
              <TextLink
                onClick={() =>
                  open({
                    kind: "evidence",
                    ids: data.currentChanges
                      .filter((c) => c.workId === suggestion.workId)
                      .flatMap((c) => c.evidenceIds),
                  })
                }
              >
                Why this appeared
              </TextLink>
            </div>
          </Card>
        ) : (
          <Empty title="Not enough context for a useful recommendation">
            Suggestions are omitted when the available work does not support
            one.
          </Empty>
        )}
      </div>
      <aside className="right-rail">
        <Card
          className="tinted"
          title="My view"
          icon={<LockSimpleIcon size={22} />}
        >
          <h3>Space to improve.</h3>
          <p>
            In a connected deployment, suggestions belong to you, not to the
            manager view.
          </p>
          <p className="small muted">
            {data.session?.mode === "gateway"
              ? "Only your authenticated identity can access these suggestions. They are not included in manager-view responses."
              : "This public demo illustrates that separation; production authorization is not connected."}
          </p>
        </Card>
        {suggestion && (
          <Card title="Expected benefit">
            <p>{suggestion.expectedBenefit}</p>
            <span className="basis">Not measured for your work</span>
          </Card>
        )}
      </aside>
    </div>
  );
}
