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
  GitBranchIcon,
} from "@phosphor-icons/react";
import type {
  Dashboard,
  Query,
  Change,
  ProjectSnapshot,
  DeliveryPlan,
} from "@/lib/contracts";
import { currentMilestone } from "@/lib/delivery";
import { DeliveryView, ProjectContext } from "./delivery-view";
import { PeriodBrief } from "./period-brief";
import { shortDate } from "@/lib/dates";
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
                    plan={data.workspace.deliveryPlans?.find(
                      (p) => p.projectId === snapshot.project.id,
                    )}
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
  plan,
  onClick,
}: {
  snapshot: ProjectSnapshot;
  plan?: DeliveryPlan;
  onClick: () => void;
}) {
  const { project, latest, current } = snapshot;
  const gate = plan ? currentMilestone(plan) : undefined;
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
          {gate
            ? gate.title
            : current
              ? latest?.title
              : "No new update in this period"}
        </strong>
        <span>
          {plan
            ? plan.decision
            : current
              ? latest?.detail
              : latest
                ? `Last record ${shortDate(latest.date)}`
                : "No collected history yet"}
        </span>
      </div>
      <div className="project-source">
        {plan && gate ? (
          <span className="portfolio-gate">
            <span>
              {gate.state === "complete" ? "Accepted" : "Next gate"}
              {gate.target ? ` · ${shortDate(gate.target)}` : ""}
            </span>
            <small>
              {plan.milestones.filter((m) => m.state === "complete").length}/
              {plan.milestones.length} milestones · As of {shortDate(plan.asOf)}
            </small>
          </span>
        ) : (
          current && latest && <Provenance change={latest} />
        )}
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
    return <PeriodBrief data={data} open={open} navigate={navigate} />;
  const plan = data.workspace.deliveryPlans?.find(
    (p) => p.projectId === project.id,
  );
  if (data.query.tab === "context")
    return (
      <ProjectContext data={data} plan={plan} open={open} navigate={navigate} />
    );
  if (plan)
    return (
      <DeliveryView data={data} plan={plan} open={open} navigate={navigate} />
    );
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
