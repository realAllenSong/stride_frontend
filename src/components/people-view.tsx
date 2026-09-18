"use client";
import {
  ArrowRightIcon,
  CaretRightIcon,
  FileTextIcon,
  LinkSimpleIcon,
  ListChecksIcon,
  UsersThreeIcon,
  TreeStructureIcon,
  CalendarBlankIcon,
} from "@phosphor-icons/react";
import type {
  Change,
  Dashboard,
  DeliveryPlan,
  DeliveryTask,
  Person,
  Query,
} from "@/lib/contracts";
import { taskStatus } from "@/lib/delivery";
import { periodLabel, shortDate } from "@/lib/dates";
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
const periodNoun = {
  daily: "day",
  weekly: "week",
  monthly: "month",
  yearly: "year",
};

function changesFor(changes: Change[], personId: string): Change[] {
  return changes.filter((c) =>
    c.contributions.some((x) => x.personId === personId),
  );
}
function ownedTasks(
  plans: DeliveryPlan[] | undefined,
  personId: string,
): { plan: DeliveryPlan; task: DeliveryTask }[] {
  return (plans ?? []).flatMap((plan) =>
    plan.tasks
      .filter((t) => t.ownerId === personId)
      .map((task) => ({ plan, task })),
  );
}
function projectsOf(data: Dashboard, changes: Change[]) {
  return [...new Set(changes.map((c) => c.projectId))]
    .map((id) => ({
      project: data.workspace.projects.find((p) => p.id === id)!,
      count: changes.filter((c) => c.projectId === id).length,
    }))
    .filter((x) => x.project)
    .sort((a, b) => b.count - a.count);
}

/* ---------- directory ---------- */

export function PeopleDirectory({ data, open, navigate }: Props) {
  const groups = data.workspace.groups.filter(
    (g) => data.query.scope === "all" || g.id === data.query.scope,
  );
  const people = data.workspace.people.filter(
    (p) => data.query.scope === "all" || p.groupId === data.query.scope,
  );
  const withRecords = people.filter(
    (p) => changesFor(data.periodChanges, p.id).length,
  ).length;
  return (
    <div className="delivery-page people-page">
      <div className="delivery-intro">
        <div>
          <p className="eyebrow">
            People · {periodLabel(data.query.date, data.query.period)}
          </p>
          <h1>{data.copy?.headline ?? "Shared work, person by person."}</h1>
          <p className="delivery-objective">
            {data.copy?.summary ??
              "What each person recorded this period, which projects it touched and which delivery tasks they hold. Contributions in context, without activity rankings."}
          </p>
        </div>
        <div className="plan-stamp">
          <span className="basis">Read-only</span>
          <span>
            {people.length} people · {withRecords} with shared records this{" "}
            {periodNoun[data.query.period]}
          </span>
          <span>Missing records are not missing work</span>
        </div>
      </div>
      {groups.map((group) => {
        const members = people.filter((p) => p.groupId === group.id);
        if (!members.length) return null;
        return (
          <section className="people-group" key={group.id}>
            <h2 className="group-label">{group.name}</h2>
            <div className="people-grid">
              {members.map((person) => (
                <PersonCard
                  key={person.id}
                  data={data}
                  person={person}
                  onClick={() =>
                    navigate({ view: "people", id: person.id, tab: "overview" })
                  }
                />
              ))}
            </div>
          </section>
        );
      })}
      <footer className="content-footer">
        <TextLink onClick={() => open({ kind: "sources" })}>
          Sources & freshness
        </TextLink>
        <span>
          {data.root.dailyIds.length} daily briefs ·{" "}
          {data.root.evidenceIds.length} linked records in scope
        </span>
      </footer>
    </div>
  );
}

function PersonCard({
  data,
  person,
  onClick,
}: {
  data: Dashboard;
  person: Person;
  onClick: () => void;
}) {
  const mine = changesFor(data.periodChanges, person.id);
  const latest = changesFor(data.currentChanges, person.id)[0];
  const projects = projectsOf(data, mine);
  const tasks = ownedTasks(data.workspace.deliveryPlans, person.id);
  const reports = data.workspace.people.filter(
    (p) => p.reportsTo === person.id,
  ).length;
  const dates = new Set(mine.map((c) => c.date));
  return (
    <button className="card person-card" onClick={onClick}>
      <div className="person-card-head">
        <Avatar initials={person.initials} color={person.color} />
        <div>
          <h3>{person.name}</h3>
          <span>
            {person.role}
            {reports ? ` · Manages ${reports}` : ""}
          </span>
        </div>
        <CaretRightIcon size={18} />
      </div>
      <p className="person-card-latest">
        {latest
          ? latest.contributions.find((c) => c.personId === person.id)
              ?.description
          : "No shared update in this period"}
      </p>
      {data.query.period !== "daily" && (
        <span className="person-dots" aria-label="Days with shared records">
          {data.digest.slots.map((slot) => {
            const hit = [...dates].some(
              (d) => d >= slot.start && d <= slot.end,
            );
            return (
              <span
                key={slot.start}
                className={`dot ${slot.future ? "future" : hit ? "on" : ""}`}
              />
            );
          })}
        </span>
      )}
      <div className="person-card-foot">
        <span className="person-projects">
          {projects.length ? (
            projects.map(({ project }) => (
              <span
                key={project.id}
                className={`avatar small ${project.color}`}
                title={project.name}
              >
                {project.initials}
              </span>
            ))
          ) : (
            <span className="muted small">Available records only</span>
          )}
        </span>
        <span className="person-meta">
          {mine.length ? `${mine.length} updates` : ""}
          {tasks.length
            ? `${mine.length ? " · " : ""}${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}`
            : ""}
        </span>
      </div>
    </button>
  );
}

/* ---------- person ---------- */

export function PersonView(props: Props) {
  const { data, open, navigate } = props;
  const person = data.selectedPerson!;
  const own = changesFor(data.currentChanges, person.id);
  const ownAll = changesFor(data.periodChanges, person.id);
  const team = data.currentChanges.filter(
    (c) =>
      c.contributions.some((x) => data.managedPersonIds.includes(x.personId)) &&
      !own.some((x) => x.id === c.id),
  );
  const isManager = data.managedPersonIds.length > 0;
  if (data.query.view === "self" && data.query.tab === "suggestions")
    return <Suggestions data={data} open={open} />;
  if (data.query.tab === "contributions")
    return <Contributions {...props} own={ownAll} team={team} />;
  const tasks = ownedTasks(data.workspace.deliveryPlans, person.id);
  const projects = projectsOf(data, ownAll);
  const collaborators = [
    ...new Set(
      ownAll.flatMap((c) =>
        c.contributions.map((x) => x.personId).filter((id) => id !== person.id),
      ),
    ),
  ]
    .map((id) => data.workspace.people.find((p) => p.id === id))
    .filter((p) => !!p);
  const manager = data.workspace.people.find((p) => p.id === person.reportsTo);
  const reports = data.workspace.people.filter(
    (p) => p.reportsTo === person.id,
  );
  const nextSteps = own.filter((c) => c.nextStep);
  const recordedDays = new Set(ownAll.map((c) => c.date)).size;
  const headline =
    data.copy?.headline ??
    (own.length
      ? `${ownAll.length} ${ownAll.length === 1 ? "update" : "updates"} across ${
          projects.length === 1
            ? projects[0].project.name
            : `${projects.length} projects`
        } this ${periodNoun[data.query.period]}.`
      : isManager && team.length
        ? "No own update recorded; team progress is below."
        : "No shared update in this period");
  const summary =
    data.copy?.summary ??
    (own.length
      ? `${recordedDays} ${recordedDays === 1 ? "day" : "days"} with shared records. Contributions are attributed to the people who made them; nothing here is a score.`
      : "There may be work outside the collected records. No performance conclusion is drawn.");
  return (
    <div className="delivery-page person-page">
      <div className="delivery-intro">
        <div>
          <p className="eyebrow">
            Person brief · {periodLabel(data.query.date, data.query.period)}
          </p>
          <h1>{headline}</h1>
          <p className="delivery-objective">{summary}</p>
        </div>
        <div className="plan-stamp">
          <span className={`basis ${data.copy ? "captured" : ""}`}>
            {data.copy ? "Generated copy · sealed" : "Derived from records"}
          </span>
          <span>
            {ownAll.length} own {ownAll.length === 1 ? "update" : "updates"} ·{" "}
            {new Set(ownAll.flatMap((c) => c.evidenceIds)).size} linked records
          </span>
          <span>
            {manager ? `Reports to ${manager.name}` : "No manager recorded"}
            {reports.length ? ` · Manages ${reports.length}` : ""}
          </span>
        </div>
      </div>
      <section className="person-facts" aria-label="Period facts">
        <FactTile
          label="Projects touched"
          value={String(projects.length)}
          detail={
            projects.length
              ? projects.map((p) => p.project.name).join(", ")
              : "No project records this period"
          }
        >
          <span className="fact-avatars">
            {projects.slice(0, 4).map(({ project }) => (
              <span
                key={project.id}
                className={`avatar small ${project.color}`}
                title={project.name}
              >
                {project.initials}
              </span>
            ))}
          </span>
        </FactTile>
        <FactTile
          label="Days with records"
          value={
            data.query.period === "daily"
              ? ownAll.length
                ? "1"
                : "0"
              : `${recordedDays} / ${data.query.period === "weekly" ? 7 : data.digest.slots.length}`
          }
          detail={
            data.query.period === "weekly"
              ? "Days in the week with a shared record"
              : data.query.period === "daily"
                ? "Records on this day"
                : `Recorded days across ${data.digest.slots.length} ${data.digest.unit}s`
          }
        >
          {data.query.period !== "daily" && (
            <span className="person-dots large">
              {data.digest.slots.map((slot) => {
                const hit = ownAll.some(
                  (c) => c.date >= slot.start && c.date <= slot.end,
                );
                return (
                  <span
                    key={slot.start}
                    className={`dot ${slot.future ? "future" : hit ? "on" : ""}`}
                    title={slot.label}
                  />
                );
              })}
            </span>
          )}
        </FactTile>
        <FactTile
          label="Delivery tasks owned"
          value={String(tasks.length)}
          detail={
            tasks.length
              ? (["doing", "review", "done", "planned"] as const)
                  .map((s) => ({
                    s,
                    n: tasks.filter((t) => t.task.status === s).length,
                  }))
                  .filter((x) => x.n)
                  .map((x) => `${x.n} ${taskStatus[x.s].toLowerCase()}`)
                  .join(" · ")
              : "No tasks assigned in recorded plans"
          }
        >
          <span className="task-dots">
            {tasks.map(({ task }) => (
              <span
                key={task.id}
                className={`dot ${task.status}`}
                title={`${task.id} · ${taskStatus[task.status]}`}
              />
            ))}
          </span>
        </FactTile>
        <FactTile
          label="Working with"
          value={String(collaborators.length)}
          detail={
            collaborators.length
              ? collaborators.map((p) => p.name.split(" ")[0]).join(", ")
              : "No co-contributors on recorded updates"
          }
        >
          <span className="fact-avatars">
            {collaborators.slice(0, 4).map((p) => (
              <Avatar key={p.id} initials={p.initials} color={p.color} small />
            ))}
          </span>
        </FactTile>
      </section>
      <div className="brief-grid">
        <div className="brief-main">
          {!!projects.length && (
            <Card title="Focus this period" icon={<ListChecksIcon size={19} />}>
              <div
                className="focus-bar"
                role="img"
                aria-label={projects
                  .map((p) => `${p.project.name}: ${p.count} updates`)
                  .join(", ")}
              >
                {projects.map(({ project, count }) => (
                  <span
                    key={project.id}
                    className={`focus-segment ${project.color}`}
                    style={{ flexGrow: count }}
                  />
                ))}
              </div>
              <div className="focus-legend">
                {projects.map(({ project, count }) => (
                  <button
                    key={project.id}
                    className="focus-item"
                    onClick={() =>
                      navigate({
                        view: "projects",
                        id: project.id,
                        scope: project.groupId,
                        tab: "overview",
                      })
                    }
                  >
                    <span className={`focus-swatch ${project.color}`} />
                    <strong>{project.name}</strong>
                    <span>
                      {count} {count === 1 ? "update" : "updates"}
                    </span>
                    <ArrowRightIcon size={13} />
                  </button>
                ))}
              </div>
              <p className="board-caption">
                Share of this person’s recorded updates by project. Coverage,
                not effort.
              </p>
            </Card>
          )}
          {!own.length && (
            <Empty title="Missing records are a coverage limit">
              <p>
                There may be work outside the collected records. No performance
                conclusion is drawn. Try an earlier period or the yearly view
                for available history.
              </p>
            </Empty>
          )}
          {isManager && !!own.length && (
            <h2 className="section-title">Own contributions</h2>
          )}
          {!!own.length && (
            <Card title={isManager ? undefined : "Contributions"}>
              <div className="stream-list">
                {own.map((c) => (
                  <ContributionRow
                    key={c.id}
                    data={data}
                    change={c}
                    personId={person.id}
                    open={open}
                    navigate={navigate}
                  />
                ))}
              </div>
              {ownAll.length > own.length && (
                <p className="board-caption">
                  Latest update per work stream · {ownAll.length} updates in
                  total. Open Contributions for every dated update.
                </p>
              )}
            </Card>
          )}
          {isManager && (
            <>
              <div className="section-heading">
                <h2 className="section-title">Team outcomes</h2>
                <span className="small muted">Contributors remain named</span>
              </div>
              <TeamBoard {...props} team={team} />
            </>
          )}
          {!!tasks.length && (
            <Card title="Delivery tasks owned" icon={<ListChecksIcon size={19} />}>
              <div className="owned-tasks">
                {tasks.map(({ plan, task }) => {
                  const project = data.workspace.projects.find(
                    (p) => p.id === plan.projectId,
                  );
                  const milestone = plan.milestones.find(
                    (m) => m.id === task.milestoneId,
                  );
                  return (
                    <button
                      className="owned-task"
                      key={task.id}
                      onClick={() =>
                        open({ kind: "task", projectId: plan.projectId, id: task.id })
                      }
                    >
                      <span className={`task-status ${task.status}`}>
                        {taskStatus[task.status]}
                      </span>
                      <span className="owned-task-body">
                        <small>
                          {task.id} · {project?.name} · {milestone?.title}
                        </small>
                        <strong>{task.title}</strong>
                        {task.blocker && (
                          <span className="task-blocker">{task.blocker}</span>
                        )}
                      </span>
                      <span className="owned-task-meta">
                        <LinkSimpleIcon size={14} /> {task.evidenceIds.length}
                        <CaretRightIcon size={15} />
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="board-caption">
                From the latest recorded delivery plans. A task state is a
                record, not a performance signal.
              </p>
            </Card>
          )}
        </div>
        <aside className="right-rail">
          {!!nextSteps.length && (
            <Card title="Next recorded steps" icon={<CalendarBlankIcon size={19} />}>
              {nextSteps.map((c) => (
                <button
                  className="linked-task"
                  key={c.id}
                  onClick={() => open({ kind: "record", id: c.nextStep!.evidenceId })}
                >
                  <span>
                    <small>
                      {data.workspace.projects.find((p) => p.id === c.projectId)?.name}{" "}
                      · Shared note · {shortDate(c.date)}
                    </small>
                    <strong>{c.nextStep!.text}</strong>
                  </span>
                  <CaretRightIcon size={16} />
                </button>
              ))}
            </Card>
          )}
          <Support data={data} open={open} />
          {!!collaborators.length && (
            <Card title="Working with" icon={<UsersThreeIcon size={19} />}>
              {collaborators.map((p) => (
                <button
                  className="contributor-link"
                  key={p.id}
                  onClick={() =>
                    navigate({ view: "people", id: p.id, scope: "all", tab: "overview" })
                  }
                >
                  <Avatar initials={p.initials} color={p.color} small />
                  <span>
                    {p.name}
                    <small>{p.role}</small>
                  </span>
                  <ArrowRightIcon size={15} />
                </button>
              ))}
            </Card>
          )}
          <Card title="Reporting line" icon={<TreeStructureIcon size={19} />}>
            {manager ? (
              <button
                className="contributor-link"
                onClick={() =>
                  navigate({ view: "people", id: manager.id, scope: "all", tab: "overview" })
                }
              >
                <Avatar initials={manager.initials} color={manager.color} small />
                <span>
                  {manager.name}
                  <small>Reports to</small>
                </span>
                <ArrowRightIcon size={15} />
              </button>
            ) : (
              <p>No manager recorded in this snapshot.</p>
            )}
            {reports.map((p) => (
              <button
                className="contributor-link"
                key={p.id}
                onClick={() =>
                  navigate({ view: "people", id: p.id, scope: "all", tab: "overview" })
                }
              >
                <Avatar initials={p.initials} color={p.color} small />
                <span>
                  {p.name}
                  <small>{p.role}</small>
                </span>
                <ArrowRightIcon size={15} />
              </button>
            ))}
            {isManager && (
              <p className="small muted">
                Team progress appears in scope. It remains the shared work of
                the original contributors; no credit is transferred.
              </p>
            )}
          </Card>
          <Card title="Available context" icon={<FileTextIcon size={19} />}>
            <p>
              {data.root.evidenceIds.length
                ? "Shared notes and linked source records for the selected period."
                : "No matching source records in this period."}
            </p>
            <TextLink onClick={() => open({ kind: "sources" })}>
              Sources & freshness
            </TextLink>
          </Card>
        </aside>
      </div>
      <footer className="content-footer">
        <TextLink onClick={() => open({ kind: "sources" })}>
          Sources & freshness
        </TextLink>
        <button className="subtle-link" onClick={() => navigate({ tab: "progress" })}>
          View dated progress <ArrowRightIcon size={16} />
        </button>
      </footer>
    </div>
  );
}

function FactTile({
  label,
  value,
  detail,
  children,
}: {
  label: string;
  value: string;
  detail: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="fact-tile">
      <span className="eyebrow">{label}</span>
      <div className="fact-tile-row">
        <strong>{value}</strong>
        {children}
      </div>
      <small>{detail}</small>
    </div>
  );
}

function ContributionRow({
  data,
  change,
  personId,
  open,
  navigate,
}: Pick<Props, "data" | "open" | "navigate"> & {
  change: Change;
  personId: string;
}) {
  const project = data.workspace.projects.find((p) => p.id === change.projectId);
  const mine = change.contributions.find((c) => c.personId === personId);
  const others = change.contributions.filter((c) => c.personId !== personId);
  return (
    <div className="stream-row static">
      <span className="stream-main">
        {project && (
          <button
            className={`project-tag ${project.color} clickable`}
            onClick={() =>
              navigate({ view: "projects", id: project.id, scope: project.groupId, tab: "overview" })
            }
          >
            {project.name}
          </button>
        )}
        <strong>{mine?.description ?? change.title}</strong>
        <span className="stream-arc">
          {change.title} · {shortDate(change.date)}
          {others.length
            ? ` · with ${others
                .map((o) => data.workspace.people.find((p) => p.id === o.personId)?.name.split(" ")[0])
                .filter(Boolean)
                .join(", ")}`
            : ""}
        </span>
      </span>
      <span className="stream-side">
        {!!change.openItems.length && (
          <span className="stream-open">{change.openItems.length} open</span>
        )}
        <span className={`basis ${mine?.basis ?? change.basis}`}>
          {basisName[mine?.basis ?? change.basis]}
        </span>
        <button
          className="icon-button"
          aria-label={`Open records for ${change.title}`}
          onClick={() => open({ kind: "evidence", ids: change.evidenceIds })}
        >
          <CaretRightIcon size={16} />
        </button>
      </span>
    </div>
  );
}

function TeamBoard({ data, team, open, navigate }: Props & { team: Change[] }) {
  const reports = data.workspace.people.filter((p) =>
    data.managedPersonIds.includes(p.id),
  );
  if (!team.length)
    return (
      <Empty title="No team updates in this period">
        No collected records are available for this reporting scope.
      </Empty>
    );
  return (
    <div className="team-board">
      {reports.map((member) => {
        const theirs = changesFor(team, member.id);
        const projects = projectsOf(data, theirs);
        return (
          <article className={`card team-member ${theirs.length ? "" : "quiet"}`} key={member.id}>
            <button
              className="team-member-head"
              onClick={() =>
                navigate({ view: "people", id: member.id, scope: "all", tab: "overview" })
              }
            >
              <Avatar initials={member.initials} color={member.color} small />
              <span>
                <strong>{member.name}</strong>
                <small>{member.role}</small>
              </span>
              <span className="team-projects">
                {projects.map(({ project }) => (
                  <span
                    key={project.id}
                    className={`project-tag ${project.color}`}
                  >
                    {project.name}
                  </span>
                ))}
              </span>
              <CaretRightIcon size={16} />
            </button>
            {theirs.length ? (
              <ul className="attribution-lines">
                {theirs.map((c) => {
                  const contribution = c.contributions.find(
                    (x) => x.personId === member.id,
                  )!;
                  return (
                    <li key={c.id}>
                      <button
                        className="attribution-line"
                        onClick={() => open({ kind: "evidence", ids: c.evidenceIds })}
                      >
                        <p>
                          <strong>{member.name}:</strong> {contribution.description}
                          <span className="provenance">
                            {basisName[contribution.basis]} · {shortDate(c.date)}
                          </span>
                        </p>
                        <span className="attribution-title">{c.title}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="muted small team-quiet">
                No shared update in this period. Missing records are not missing work.
              </p>
            )}
          </article>
        );
      })}
    </div>
  );
}

function Contributions({
  data,
  open,
  navigate,
  own,
  team,
}: Props & { own: Change[]; team: Change[] }) {
  const person = data.selectedPerson!;
  const isManager = data.managedPersonIds.length > 0;
  return (
    <div className="delivery-page person-page">
      <div className="delivery-intro">
        <div>
          <p className="eyebrow">
            Contributions · {periodLabel(data.query.date, data.query.period)}
          </p>
          <h1>Contributions to shared work.</h1>
          <p className="delivery-objective">
            Every update {person.name.split(" ")[0]} is named on, with the
            other contributors and the records behind it.
          </p>
        </div>
      </div>
      {!own.length && (
        <Empty title="No shared update in this period">
          <p>
            There may be work outside the collected records. No performance
            conclusion is drawn.
          </p>
        </Empty>
      )}
      <div className="contribution-grid">
        {own.map((c) => (
          <ContributionCard key={c.id} data={data} change={c} open={open} navigate={navigate} />
        ))}
      </div>
      {isManager && !!team.length && (
        <>
          <div className="section-heading">
            <h2 className="section-title">Team outcomes</h2>
            <span className="small muted">Contributors remain named</span>
          </div>
          <div className="contribution-grid">
            {team.map((c) => (
              <ContributionCard key={c.id} data={data} change={c} open={open} navigate={navigate} />
            ))}
          </div>
        </>
      )}
      <footer className="content-footer">
        <TextLink onClick={() => open({ kind: "sources" })}>
          Sources & freshness
        </TextLink>
        <button className="subtle-link" onClick={() => navigate({ tab: "overview" })}>
          Back to brief <ArrowRightIcon size={16} />
        </button>
      </footer>
    </div>
  );
}

function ContributionCard({
  data,
  change,
  open,
  navigate,
}: Pick<Props, "data" | "open" | "navigate"> & { change: Change }) {
  const project = data.workspace.projects.find((p) => p.id === change.projectId)!;
  return (
    <Card className="work-card">
      <div className="work-card-heading">
        <span className={`project-tag ${project.color}`}>{project.name}</span>
        <button
          className="icon-button"
          aria-label={`Open project ${project.name}`}
          onClick={() =>
            navigate({ view: "projects", id: project.id, scope: project.groupId, tab: "overview" })
          }
        >
          <CaretRightIcon size={22} />
        </button>
      </div>
      <h2>{change.title}</h2>
      <p>{change.detail}</p>
      <div className="attribution-lines">
        {change.contributions.map((c) => (
          <p key={c.personId}>
            <strong>{data.workspace.people.find((p) => p.id === c.personId)?.name}:</strong>{" "}
            {c.description}
            <span className="provenance">{basisName[c.basis]}</span>
          </p>
        ))}
      </div>
      {change.value && (
        <div className="value-line">
          <span>Intended value</span>
          <p>{change.value}</p>
        </div>
      )}
      <div className="card-bottom">
        <TextLink onClick={() => open({ kind: "evidence", ids: change.evidenceIds })}>
          <LinkSimpleIcon size={20} />
          {change.basis === "reported" ? "View reported context" : "View supporting records"}
        </TextLink>
        <span className="provenance">
          {basisName[change.basis]} · {shortDate(change.date)}
        </span>
      </div>
    </Card>
  );
}

function Suggestions({ data, open }: Pick<Props, "data" | "open">) {
  const suggestion = data.suggestions[0];
  return (
    <div className="main-grid">
      <div className="main-column">
        <div className="page-intro">
          <h1>
            {suggestion ? "One idea for your next review." : "No suggestion for this period."}
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
            <p className="muted small">A suggestion, not a recorded commitment.</p>
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
            Suggestions are omitted when the available work does not support one.
          </Empty>
        )}
      </div>
      <aside className="right-rail">
        <Card className="tinted" title="My view">
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
