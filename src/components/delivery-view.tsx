"use client";
import { useState } from "react";
import {
  ArrowRightIcon,
  CheckIcon,
  FlagIcon,
  GitBranchIcon,
  LinkSimpleIcon,
  MagnifyingGlassIcon,
  CaretRightIcon,
} from "@phosphor-icons/react";
import type {
  Dashboard,
  DeliveryPlan,
  DeliveryTask,
  Query,
} from "@/lib/contracts";
import { currentMilestone, taskStatus } from "@/lib/delivery";
import { shortDate } from "@/lib/dates";
import type { OpenDetail } from "./dialogs";
import { Avatar, Card, Criterion, Empty, TextLink } from "./ui";

type Props = {
  data: Dashboard;
  plan: DeliveryPlan;
  open: OpenDetail;
  navigate: (patch: Partial<Query>) => void;
};

export function DeliveryView(props: Props) {
  return <DeliveryBoard key={props.plan.id} {...props} />;
}

function DeliveryBoard({ data, plan, open, navigate }: Props) {
  const [selection, setSelection] = useState(currentMilestone(plan).id);
  const [search, setSearch] = useState("");
  const milestone = plan.milestones.find((m) => m.id === selection);
  const tasks = plan.tasks.filter(
    (t) =>
      (!milestone || t.milestoneId === milestone.id) &&
      `${t.id} ${t.title} ${t.summary}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const active = currentMilestone(plan);
  const completed = plan.milestones.filter(
    (m) => m.state === "complete",
  ).length;
  return (
    <div className="delivery-page">
      <div className="delivery-intro">
        <div>
          <p className="eyebrow">PROJECT DELIVERY</p>
          <h1>{plan.headline ?? `${data.selectedProject?.name} delivery`}</h1>
          <p className="delivery-objective">{plan.objective}</p>
        </div>
        <div className="plan-stamp">
          <span className="basis">{plan.origin}</span>
          <span>Snapshot · {shortDate(plan.asOf)}</span>
          <span>
            {completed} of {plan.milestones.length} milestones accepted
          </span>
        </div>
      </div>
      {(data.notice || data.conflict) && (
        <div className="context-banner">
          <span>{data.notice?.text ?? data.conflict?.headline}</span>
          <TextLink
            onClick={() =>
              open({
                kind: "evidence",
                ids: data.conflict?.observationIds ?? [data.notice!.evidenceId],
              })
            }
          >
            Compare records
          </TextLink>
        </div>
      )}
      {plan.asOf < data.range.start && (
        <p className="context-banner">
          No plan update in this period. Showing the recorded state from{" "}
          {shortDate(plan.asOf)}, not current completion.
        </p>
      )}
      <section className="milestone-roadmap" aria-label="Delivery milestones">
        {plan.milestones.map((m, i) => (
          <button
            key={m.id}
            className={`roadmap-step ${m.state}`}
            aria-pressed={selection === m.id}
            onClick={() => {
              setSelection(m.id);
              setSearch("");
            }}
          >
            <span className="roadmap-top">
              <span className="roadmap-dot">
                {m.state === "complete" ? (
                  <CheckIcon size={16} weight="bold" />
                ) : (
                  String(i + 1).padStart(2, "0")
                )}
              </span>
              <span>
                {m.state === "complete"
                  ? "Accepted"
                  : m.state === "active"
                    ? "Current milestone"
                    : "Upcoming"}
              </span>
            </span>
            <strong>{m.title}</strong>
            <span className="roadmap-date">
              {m.target ? `Target ${shortDate(m.target)}` : "No target date"}
            </span>
          </button>
        ))}
      </section>
      <div className="delivery-grid">
        <div className="delivery-main">
          <section className="delivery-goal">
            <div>
              <span className="eyebrow">
                {milestone
                  ? `MILESTONE ${plan.milestones.indexOf(milestone) + 1}`
                  : "COMPLETE PROJECT SCOPE"}
              </span>
              <h2>{milestone?.title ?? "All delivery work"}</h2>
              <p>
                {milestone?.outcome ??
                  "Tasks grouped by recorded state, across every milestone."}
              </p>
            </div>
            {milestone && (
              <TextLink
                onClick={() =>
                  open({
                    kind: "delivery-milestone",
                    projectId: plan.projectId,
                    id: milestone.id,
                  })
                }
              >
                Exit criteria
              </TextLink>
            )}
          </section>
          <div className="board-toolbar">
            <div className="segmented">
              <button
                aria-pressed={!!milestone}
                onClick={() => setSelection(active.id)}
              >
                Milestone work
              </button>
              <button
                aria-pressed={!milestone}
                onClick={() => setSelection("all")}
              >
                All work <span>{plan.tasks.length}</span>
              </button>
            </div>
            <label className="board-search">
              <MagnifyingGlassIcon size={17} />
              <input
                aria-label="Find a delivery task"
                placeholder="Find a task…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
          </div>
          <div className="delivery-board" aria-label="Read-only delivery board">
            {(Object.keys(taskStatus) as DeliveryTask["status"][]).map(
              (status) => {
                const laneTasks = tasks.filter((t) => t.status === status);
                return (
                  <section
                    className={`board-lane ${status}`}
                    key={status}
                    aria-label={taskStatus[status]}
                  >
                    <h3>
                      <span className="lane-dot" />
                      {taskStatus[status]}
                      <span className="lane-count">{laneTasks.length}</span>
                    </h3>
                    {laneTasks.map((task) => {
                      const owner = data.workspace.people.find(
                        (p) => p.id === task.ownerId,
                      );
                      return (
                        <button
                          className="delivery-task"
                          key={task.id}
                          aria-label={`Open ${task.id}: ${task.title}`}
                          onClick={() =>
                            open({
                              kind: "task",
                              projectId: plan.projectId,
                              id: task.id,
                            })
                          }
                        >
                          <span className="task-reference">
                            {task.id}
                            <CaretRightIcon size={14} />
                          </span>
                          <strong>{task.title}</strong>
                          {task.blocker && (
                            <span className="task-blocker">{task.blocker}</span>
                          )}
                          <span className="task-footer">
                            {owner ? (
                              <span className="task-owner">
                                <Avatar
                                  initials={owner.initials}
                                  color={owner.color}
                                  small
                                />
                                <span>{owner.name.split(" ")[0]}</span>
                              </span>
                            ) : (
                              <span>Unassigned</span>
                            )}
                            <span
                              aria-label={`${task.evidenceIds.length} supporting records`}
                            >
                              <LinkSimpleIcon size={14} />{" "}
                              {task.evidenceIds.length}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                    {!laneTasks.length && (
                      <p className="lane-empty">
                        {search ? "No matches" : "No tasks"}
                      </p>
                    )}
                  </section>
                );
              },
            )}
          </div>
          <p className="board-caption">
            Recorded task states · Read-only · A completed task is not a
            deployed release.
          </p>
        </div>
        <aside className="delivery-rail">
          <Card
            title="Next delivery gate"
            className="tinted"
            icon={<FlagIcon size={19} />}
          >
            <h3>{active.title}</h3>
            <p>{plan.decision}</p>
            <TextLink
              onClick={() =>
                open({
                  kind: "delivery-milestone",
                  projectId: plan.projectId,
                  id: active.id,
                })
              }
            >
              What needs to pass
            </TextLink>
          </Card>
          <Card title="Project context" icon={<GitBranchIcon size={19} />}>
            {plan.resources.slice(0, 3).map((r) => (
              <button
                className="context-resource-link"
                key={r.id}
                onClick={() =>
                  open({
                    kind: "resource",
                    projectId: plan.projectId,
                    id: r.id,
                  })
                }
              >
                <span>
                  <small>{r.kind}</small>
                  <strong>{r.title}</strong>
                </span>
                <CaretRightIcon size={16} />
              </button>
            ))}
            {!plan.resources.length && (
              <p>No context documents recorded in this snapshot.</p>
            )}
            <TextLink onClick={() => navigate({ tab: "context" })}>
              Explore connections
            </TextLink>
          </Card>
          <div className="delivery-owners">
            <span className="eyebrow">PROJECT OWNERS</span>
            {data.selectedProject?.ownerIds.map((id) => {
              const p = data.workspace.people.find((p) => p.id === id);
              return (
                p && (
                  <button
                    className="contributor-link"
                    key={id}
                    onClick={() =>
                      navigate({
                        view: "people",
                        id,
                        scope: "all",
                        tab: "contributions",
                      })
                    }
                  >
                    <Avatar initials={p.initials} color={p.color} small />
                    {p.name}
                    <ArrowRightIcon size={15} />
                  </button>
                )
              );
            })}
          </div>
        </aside>
      </div>
      <footer className="content-footer">
        <TextLink onClick={() => open({ kind: "sources" })}>
          Sources & freshness
        </TextLink>
        <button
          className="subtle-link"
          onClick={() => navigate({ tab: "progress" })}
        >
          View dated activity <ArrowRightIcon size={16} />
        </button>
      </footer>
    </div>
  );
}

export function ProjectContext({
  data,
  plan,
  open,
  navigate,
}: Omit<Props, "plan"> & { plan?: DeliveryPlan }) {
  if (!plan)
    return (
      <Empty title="No project context recorded">
        <p>
          Available notes remain in Activity. A delivery plan or runbook has not
          been supplied for this snapshot.
        </p>
        <TextLink onClick={() => navigate({ tab: "progress" })}>
          View activity
        </TextLink>
      </Empty>
    );
  return (
    <ContextMap
      key={plan.id}
      data={data}
      plan={plan}
      open={open}
      navigate={navigate}
    />
  );
}

function ContextMap({ data, plan, open, navigate }: Props) {
  const [selected, setSelected] = useState(
    plan.resources[0]?.id ?? currentMilestone(plan).id,
  );
  const compactMap = plan.milestones.length <= 4 && plan.resources.length <= 3;
  const [mode, setMode] = useState(compactMap ? "map" : "list");
  const milestone = plan.milestones.find((m) => m.id === selected);
  const resource = plan.resources.find((r) => r.id === selected);
  const relatedTasks = plan.tasks.filter((t) =>
    resource
      ? resource.taskIds.includes(t.id)
      : t.milestoneId === milestone?.id,
  );
  // Stable, bounded node layout. Dependency semantics come from the plan, not spatial proximity.
  const nodes = [
    ...plan.milestones.map((m, i) => ({
      id: m.id,
      title: m.title,
      kind: "milestone",
      x: 12 + (i * 76) / Math.max(plan.milestones.length - 1, 1),
      y: 22,
    })),
    ...plan.resources.map((r, i) => ({
      id: r.id,
      title: r.title,
      kind: r.kind,
      x: 15 + (i * 70) / Math.max(plan.resources.length - 1, 1),
      y: 80,
    })),
  ];
  const evidenceIds =
    resource?.evidenceIds ??
    milestone?.criteria.flatMap((c) => c.evidenceIds) ??
    [];
  const renderNode = (node: (typeof nodes)[number]) => (
    <button
      key={node.id}
      className={`map-node ${node.kind}`}
      style={
        mode === "map" ? { left: `${node.x}%`, top: `${node.y}%` } : undefined
      }
      aria-pressed={selected === node.id}
      onClick={() => setSelected(node.id)}
    >
      <small>{node.kind}</small>
      <strong>{node.title}</strong>
    </button>
  );
  return (
    <div className="delivery-page">
      <div className="delivery-intro">
        <div>
          <p className="eyebrow">PROJECT CONTEXT</p>
          <h1>Understand the project before stepping in.</h1>
          <p className="delivery-objective">
            Delivery gates, linked work and the documents that explain them.
          </p>
        </div>
        <div className="segmented">
          {compactMap && (
            <button
              aria-pressed={mode === "map"}
              onClick={() => setMode("map")}
            >
              Map
            </button>
          )}
          <button
            aria-pressed={mode === "list"}
            onClick={() => setMode("list")}
          >
            Outline
          </button>
        </div>
      </div>
      <div className="project-context-grid">
        <section
          className="card context-map-card"
          aria-label="Project relationship map"
        >
          <div className="map-title">
            <span>
              <GitBranchIcon size={18} /> {data.selectedProject?.name}
            </span>
            <span>{nodes.length} linked nodes</span>
          </div>
          <div className={mode === "map" ? "project-map" : "project-outline"}>
            {mode === "map" && (
              <>
                <svg
                  className="map-edges"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  {nodes
                    .filter((n) => n.kind === "milestone")
                    .map((n, i, ms) => (
                      <g key={n.id}>
                        <path
                          d={`M 50 49 Q ${n.x} 49 ${n.x} 22`}
                          className={selected === n.id ? "focused" : ""}
                        />
                        {i > 0 && (
                          <path
                            d={`M ${ms[i - 1].x} 22 L ${n.x} 22`}
                            className="sequence"
                          />
                        )}
                      </g>
                    ))}
                  {plan.resources.flatMap((r) => {
                    const node = nodes.find((n) => n.id === r.id)!;
                    const milestoneIds = new Set(
                      plan.tasks
                        .filter((t) => r.taskIds.includes(t.id))
                        .map((t) => t.milestoneId),
                    );
                    return [...milestoneIds].map((id) => {
                      const target = nodes.find((n) => n.id === id)!;
                      return (
                        <path
                          key={`${r.id}-${id}`}
                          d={`M ${node.x} 80 C ${node.x} 60 ${target.x} 55 ${target.x} 22`}
                          className={`resource-edge ${selected === r.id || selected === id ? "focused" : ""}`}
                        />
                      );
                    });
                  })}
                </svg>
                <div className="map-root">
                  <GitBranchIcon size={23} />
                  <strong>{data.selectedProject?.name}</strong>
                  <span>Delivery & context</span>
                </div>
              </>
            )}
            {nodes.map(renderNode)}
          </div>
          <div className="map-legend">
            <span>Milestones in delivery order</span>
            <span>Dashed links = supporting context</span>
          </div>
        </section>
        <aside className="card context-inspector" aria-live="polite">
          <p className="eyebrow">{resource?.kind ?? "Milestone"}</p>
          <h2>{resource?.title ?? milestone?.title}</h2>
          <p>{resource?.summary ?? milestone?.outcome}</p>
          {resource && (
            <TextLink
              onClick={() =>
                open({
                  kind: "resource",
                  projectId: plan.projectId,
                  id: resource.id,
                })
              }
            >
              Read full context
            </TextLink>
          )}
          {milestone && (
            <TextLink
              onClick={() =>
                open({
                  kind: "delivery-milestone",
                  projectId: plan.projectId,
                  id: milestone.id,
                })
              }
            >
              View exit criteria
            </TextLink>
          )}
          <h3 className="inspector-label">
            Linked work · {relatedTasks.length}
          </h3>
          {relatedTasks.map((t) => (
            <button
              className="linked-task"
              key={t.id}
              onClick={() =>
                open({ kind: "task", projectId: plan.projectId, id: t.id })
              }
            >
              <span>
                <small>
                  {t.id} · {taskStatus[t.status]}
                </small>
                <strong>{t.title}</strong>
              </span>
              <CaretRightIcon size={16} />
            </button>
          ))}
          {!relatedTasks.length && (
            <p className="muted">No linked tasks recorded.</p>
          )}
          {!!evidenceIds.length && (
            <TextLink
              onClick={() =>
                open({ kind: "evidence", ids: [...new Set(evidenceIds)] })
              }
            >
              Supporting evidence
            </TextLink>
          )}
        </aside>
      </div>
      {!!plan.relatedProjects.length && (
        <section className="related-projects">
          <h2>Connected projects</h2>
          {plan.relatedProjects.map((related) => {
            const p = data.workspace.projects.find(
              (p) => p.id === related.projectId,
            );
            return (
              p && (
                <button
                  key={p.id}
                  onClick={() =>
                    navigate({ id: p.id, scope: "all", tab: "context" })
                  }
                >
                  <Avatar initials={p.initials} color={p.color} small />
                  <span>
                    <strong>{p.name}</strong>
                    <small>{related.relation}</small>
                  </span>
                  <ArrowRightIcon size={18} />
                </button>
              )
            );
          })}
        </section>
      )}
      <footer className="content-footer">
        <TextLink onClick={() => open({ kind: "sources" })}>
          Sources & freshness
        </TextLink>
        <span>
          Snapshot · {shortDate(plan.asOf)} · Read-only context, not an on-call
          dispatcher
        </span>
      </footer>
    </div>
  );
}

export function DeliveryDetail({
  data,
  projectId,
  id,
  kind,
  open,
  navigate,
}: {
  data: Dashboard;
  projectId: string;
  id: string;
  kind: "task" | "resource" | "delivery-milestone";
  open: OpenDetail;
  navigate: Props["navigate"];
}) {
  const plan = data.workspace.deliveryPlans?.find(
    (p) => p.projectId === projectId,
  );
  const task = plan?.tasks.find((t) => t.id === id);
  const milestone = plan?.milestones.find(
    (m) => m.id === (kind === "task" ? task?.milestoneId : id),
  );
  const resource = plan?.resources.find((r) => r.id === id);
  if (
    !plan ||
    (kind === "task" && !task) ||
    (kind === "resource" && !resource) ||
    (kind === "delivery-milestone" && !milestone)
  )
    return <p>This item is not available in the selected snapshot.</p>;
  const owner = data.workspace.people.find((p) => p.id === task?.ownerId);
  const ids =
    task && kind === "task"
      ? task.evidenceIds
      : (resource?.evidenceIds ??
        milestone?.criteria.flatMap((c) => c.evidenceIds) ??
        []);
  return (
    <div className="delivery-detail">
      {kind === "task" && task && (
        <>
          <div className="detail-state">
            <span>{task.id}</span>
            <span className={`task-status ${task.status}`}>
              {taskStatus[task.status]}
            </span>
            <span>As of {shortDate(plan.asOf)}</span>
          </div>
          <h2>{task.title}</h2>
          <p>{task.summary}</p>
          {task.blocker && (
            <div className="task-blocker detail-blocker">{task.blocker}</div>
          )}
          <div className="detail-assignment">
            <span>Owner</span>
            {owner ? (
              <TextLink
                onClick={() =>
                  navigate({
                    view: "people",
                    id: owner.id,
                    scope: "all",
                    tab: "contributions",
                  })
                }
              >
                <Avatar initials={owner.initials} color={owner.color} small />
                {owner.name}
              </TextLink>
            ) : (
              <span>Not assigned</span>
            )}
          </div>
          <button
            className="linked-task"
            onClick={() =>
              open({
                kind: "delivery-milestone",
                projectId,
                id: task.milestoneId,
              })
            }
          >
            <span>
              <small>Milestone</small>
              <strong>{milestone?.title}</strong>
            </span>
            <CaretRightIcon size={18} />
          </button>
          <h3>Acceptance conditions</h3>
          <ul className="record-items">
            {task.acceptance.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <h3>Depends on</h3>
          {task.dependsOn.length ? (
            task.dependsOn.map((id) => {
              const t = plan.tasks.find((t) => t.id === id)!;
              return (
                <button
                  className="linked-task"
                  key={id}
                  onClick={() => open({ kind: "task", projectId, id })}
                >
                  <span>
                    <small>
                      {id} · {taskStatus[t.status]}
                    </small>
                    <strong>{t.title}</strong>
                  </span>
                  <CaretRightIcon size={16} />
                </button>
              );
            })
          ) : (
            <p className="muted">No task dependencies recorded.</p>
          )}
          {!!plan.tasks.filter((t) => t.dependsOn.includes(task.id)).length && (
            <>
              <h3>Unblocks</h3>
              {plan.tasks
                .filter((t) => t.dependsOn.includes(task.id))
                .map((t) => (
                  <button
                    className="linked-task"
                    key={t.id}
                    onClick={() => open({ kind: "task", projectId, id: t.id })}
                  >
                    <span>
                      <small>{t.id}</small>
                      <strong>{t.title}</strong>
                    </span>
                    <ArrowRightIcon size={16} />
                  </button>
                ))}
            </>
          )}
        </>
      )}
      {kind === "delivery-milestone" && milestone && (
        <>
          <div className="detail-state">
            <span>
              Milestone {plan.milestones.indexOf(milestone) + 1} of{" "}
              {plan.milestones.length}
            </span>
            <span>
              {milestone.state === "complete"
                ? "Accepted"
                : milestone.state === "active"
                  ? "Current"
                  : "Planned"}
            </span>
          </div>
          <h2>{milestone.title}</h2>
          <p>{milestone.outcome}</p>
          <p className="muted">
            {milestone.target ? `Target ${shortDate(milestone.target)} · ` : ""}
            Targets are plans, not completion forecasts.
          </p>
          <h3>Exit criteria</h3>
          {milestone.criteria.map((c) => (
            <div className="delivery-criterion" key={c.label}>
              <Criterion
                label={c.label}
                state={c.state}
                detail={
                  c.state === "unknown"
                    ? "No matching validation recorded"
                    : undefined
                }
              />
              {!!c.evidenceIds.length && (
                <TextLink
                  onClick={() => open({ kind: "evidence", ids: c.evidenceIds })}
                >
                  Check evidence
                </TextLink>
              )}
            </div>
          ))}
          <h3>Milestone work</h3>
          {plan.tasks
            .filter((t) => t.milestoneId === milestone.id)
            .map((t) => (
              <button
                className="linked-task"
                key={t.id}
                onClick={() => open({ kind: "task", projectId, id: t.id })}
              >
                <span>
                  <small>
                    {t.id} · {taskStatus[t.status]}
                  </small>
                  <strong>{t.title}</strong>
                </span>
                <CaretRightIcon size={16} />
              </button>
            ))}
          {!plan.tasks.some((t) => t.milestoneId === milestone.id) && (
            <p className="muted">No sub-tasks have been supplied yet.</p>
          )}
        </>
      )}
      {kind === "resource" && resource && (
        <>
          <span className="basis">
            {resource.kind} · {plan.origin}
          </span>
          <h2>{resource.title}</h2>
          <p>{resource.summary}</p>
          {resource.sections.map((s) => (
            <section className="resource-section" key={s.title}>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </section>
          ))}
          <h3>Related work</h3>
          {resource.taskIds.map((id) => {
            const t = plan.tasks.find((t) => t.id === id)!;
            return (
              <button
                className="linked-task"
                key={id}
                onClick={() => open({ kind: "task", projectId, id })}
              >
                <span>
                  <small>{id}</small>
                  <strong>{t.title}</strong>
                </span>
                <CaretRightIcon size={16} />
              </button>
            );
          })}
        </>
      )}
      <div className="detail-proof">
        <h3>Supporting records</h3>
        {ids.length ? (
          [...new Set(ids)].map((id) => {
            const e = data.workspace.evidence.find((e) => e.id === id);
            return (
              e && (
                <button
                  className="linked-task"
                  key={id}
                  onClick={() => open({ kind: "evidence", ids: [id] })}
                >
                  <span>
                    <small>
                      {e.source} · {shortDate(e.date)}
                    </small>
                    <strong>{e.title}</strong>
                  </span>
                  <LinkSimpleIcon size={18} />
                </button>
              )
            );
          })
        ) : (
          <p className="muted">
            No evidence attached yet. Planned work is not a verified result.
          </p>
        )}
      </div>
    </div>
  );
}
