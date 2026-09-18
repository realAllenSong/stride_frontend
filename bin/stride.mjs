#!/usr/bin/env node
// STRIDE CLI: a thin, dependency-free client for the read-only API.
// Humans get tables; agents pass --json (raw) or --md (Markdown brief).
// Access is whatever the server grants the bearer token; the CLI cannot widen it.

const HELP = `stride — read-only work briefs for people and agents

Usage
  stride [global options] <command> [arguments] [options]

Commands
  workspace                          Groups, people, projects and source availability
  projects [--scope G]               Projects with their current delivery gate
  project <id>                       One project: plan, work streams, evidence
  graph [<project-id>] [--dot|--mermaid]
                                     Relationship graph for the workspace or one project
  people [--period P] [--scope G]    People with record coverage for the period
  person <id> [--period P]           One person: streams, tasks owned, collaborators
  brief [--view projects|people] [--id ID] [--scope G] [--period P] [--md]
                                     Period brief with headline, bounded copy and digest
  evidence <id>                      One evidence record and the changes that cite it
  openapi                            OpenAPI 3.1 document for this server
  health                             Liveness check

Global options
  --url <base>       Server base URL     (env STRIDE_URL, default http://127.0.0.1:3100)
  --token <jwt>      Bearer token        (env STRIDE_TOKEN; required in gateway mode)
  --date <YYYY-MM-DD> As-of date         (default: latest snapshot; later dates never show later results)
  --json             Print the raw JSON response
  -h, --help         Show this help

Examples
  stride projects
  stride project praetorian --date 2026-09-05
  stride graph praetorian --mermaid
  stride brief --id praetorian --period monthly --md
  stride person zhiyuan --period weekly --json
  STRIDE_TOKEN=... stride people --url https://stride.internal
`;

const PERIODS = new Set(["daily", "weekly", "monthly", "yearly"]);

function parseArgs(argv) {
  const options = { json: false, dot: false, mermaid: false, md: false };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") options.help = true;
    else if (arg === "--json") options.json = true;
    else if (arg === "--dot") options.dot = true;
    else if (arg === "--mermaid") options.mermaid = true;
    else if (arg === "--md") options.md = true;
    else if (arg.startsWith("--")) {
      const [key, inline] = arg.slice(2).split("=", 2);
      const value = inline ?? argv[++i];
      if (value === undefined) fail(`Missing value for --${key}`);
      options[key] = value;
    } else positional.push(arg);
  }
  return { options, positional };
}

function fail(message, code = 2) {
  process.stderr.write(`stride: ${message}\n`);
  process.exit(code);
}

async function get(base, token, path, params = {}) {
  const url = new URL(path, base);
  for (const [k, v] of Object.entries(params))
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  let response;
  try {
    response = await fetch(url, { headers });
  } catch (error) {
    fail(`Cannot reach ${url.origin} (${error.message}). Is the server running?`, 3);
  }
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    fail(`Non-JSON response (${response.status}) from ${url.pathname}`, 3);
  }
  if (!response.ok)
    fail(
      `${response.status} ${body.error ?? response.statusText}${
        body.issues ? `\n${JSON.stringify(body.issues, null, 2)}` : ""
      }`,
      response.status === 401 ? 4 : response.status === 403 ? 5 : 3,
    );
  return body;
}

/* ---------- formatting ---------- */

const pad = (value, width) => String(value ?? "").padEnd(width);
function table(rows, columns) {
  if (!rows.length) return "(none)\n";
  const widths = columns.map((c) =>
    Math.max(c.label.length, ...rows.map((r) => String(c.get(r) ?? "").length)),
  );
  const line = (cells) =>
    cells.map((cell, i) => pad(cell, widths[i])).join("  ").trimEnd() + "\n";
  return (
    line(columns.map((c) => c.label)) +
    line(widths.map((w) => "-".repeat(w))) +
    rows.map((r) => line(columns.map((c) => c.get(r)))).join("")
  );
}
const state = { planned: "planned", active: "current", complete: "accepted" };
const status = { planned: "Planned", doing: "In progress", review: "In review", done: "Done" };

function printWorkspace(w) {
  let out = `Snapshot ${w.asOf} · ${w.session?.mode ?? "demo"} mode${w.session?.synthetic ? " · illustrative data" : ""}\n\n`;
  out += "Groups\n" + table(w.groups, [{ label: "ID", get: (g) => g.id }, { label: "Name", get: (g) => g.name }]) + "\n";
  out += "Projects\n" + table(w.projects, [
    { label: "ID", get: (p) => p.id },
    { label: "Name", get: (p) => p.name },
    { label: "Group", get: (p) => p.groupId },
    { label: "Owners", get: (p) => p.ownerIds.join(", ") },
  ]) + "\n";
  out += "People\n" + table(w.people, [
    { label: "ID", get: (p) => p.id },
    { label: "Name", get: (p) => p.name },
    { label: "Role", get: (p) => p.role },
    { label: "Reports to", get: (p) => p.reportsTo ?? "—" },
  ]) + "\n";
  out += "Sources\n" + table(w.sources, [
    { label: "Source", get: (s) => s.source },
    { label: "Status", get: (s) => s.status },
    { label: "As of", get: (s) => s.asOf },
    { label: "Note", get: (s) => s.note ?? "" },
  ]);
  return out;
}

function printProjects(r) {
  return `As of ${r.asOf}\n\n` + table(r.projects, [
    { label: "ID", get: (p) => p.id },
    { label: "Project", get: (p) => p.name },
    { label: "Current gate", get: (p) => (p.plan ? `${p.plan.currentMilestone.title} (${state[p.plan.currentMilestone.state]})` : "no plan recorded") },
    { label: "Milestones", get: (p) => (p.plan ? `${p.plan.milestones.accepted}/${p.plan.milestones.total}` : "—") },
    { label: "Open tasks", get: (p) => (p.plan ? p.plan.tasks.doing + p.plan.tasks.review + p.plan.tasks.planned : "—") },
    { label: "Latest record", get: (p) => (p.latest ? `${p.latest.date} ${p.latest.title}` : "none") },
  ]);
}

function printProject(r) {
  const { project, plan } = r;
  let out = `${project.name} (${project.id}) · ${project.groupId} · as of ${r.asOf}\n${project.purpose}\nOwners: ${project.owners.map((o) => o.name).join(", ") || "—"}\n\n`;
  if (plan) {
    out += `Delivery plan · snapshot ${plan.asOf} · ${plan.origin}\n${plan.headline ?? ""}\nObjective: ${plan.objective}\nDecision:  ${plan.decision}\n\nMilestones\n`;
    out += table(plan.milestones, [
      { label: "#", get: (m) => plan.milestones.indexOf(m) + 1 },
      { label: "Milestone", get: (m) => m.title },
      { label: "State", get: (m) => state[m.state] },
      { label: "Target", get: (m) => m.target ?? "—" },
      { label: "Criteria met", get: (m) => `${m.criteria.filter((c) => c.state === "met").length}/${m.criteria.length}` },
    ]);
    out += "\nTasks\n" + table(plan.tasks, [
      { label: "ID", get: (t) => t.id },
      { label: "Task", get: (t) => t.title },
      { label: "Status", get: (t) => status[t.status] },
      { label: "Owner", get: (t) => t.ownerId ?? "—" },
      { label: "Depends on", get: (t) => t.dependsOn.join(", ") || "—" },
      { label: "Blocker", get: (t) => t.blocker ?? "" },
    ]);
    if (plan.resources.length)
      out += "\nContext\n" + table(plan.resources, [
        { label: "Kind", get: (x) => x.kind },
        { label: "Title", get: (x) => x.title },
        { label: "Tasks", get: (x) => x.taskIds.join(", ") },
      ]);
    if (r.related.length)
      out += "\nRelated projects\n" + table(r.related, [
        { label: "Project", get: (x) => x.name ?? x.projectId },
        { label: "Relation", get: (x) => x.relation },
      ]);
  } else out += "No delivery plan recorded at this date.\n";
  out += "\nWork streams\n" + table(r.streams, [
    { label: "Stream", get: (s) => s.last.title },
    { label: "From", get: (s) => s.first.date },
    { label: "To", get: (s) => s.last.date },
    { label: "Updates", get: (s) => s.changeIds.length },
    { label: "Open items", get: (s) => s.openItems.join("; ") },
  ]);
  out += "\nEvidence\n" + table(r.evidence, [
    { label: "ID", get: (e) => e.id },
    { label: "Date", get: (e) => e.date },
    { label: "Source", get: (e) => e.source },
    { label: "Basis", get: (e) => e.basis },
    { label: "Title", get: (e) => e.title + (e.restricted ? " [restricted]" : "") },
  ]);
  return out;
}

function printGraph(g, options) {
  const q = (s) => JSON.stringify(String(s));
  if (options.dot) {
    const shape = { project: "box", group: "folder", milestone: "hexagon", task: "note", resource: "component", person: "ellipse", evidence: "plaintext" };
    return [
      "digraph stride {",
      "  rankdir=LR; node [fontname=Helvetica, fontsize=10]; edge [fontsize=8, color=gray50];",
      ...g.nodes.map((n) => `  ${q(n.id)} [label=${q(n.label + (n.state ? `\\n${n.state}` : ""))}, shape=${shape[n.kind] ?? "box"}];`),
      ...g.edges.map((e) => `  ${q(e.from)} -> ${q(e.to)} [label=${q(e.label ? `${e.kind}: ${e.label}` : e.kind)}];`),
      "}",
    ].join("\n") + "\n";
  }
  if (options.mermaid) {
    const id = (s) => s.replace(/[^a-zA-Z0-9]/g, "_");
    return [
      "graph LR",
      ...g.nodes.map((n) => `  ${id(n.id)}["${n.label.replace(/"/g, "'")}${n.state ? `<br/><i>${n.state}</i>` : ""}"]`),
      ...g.edges.map((e) => `  ${id(e.from)} -->|${e.kind}| ${id(e.to)}`),
    ].join("\n") + "\n";
  }
  let out = `As of ${g.asOf}${g.planAsOf ? ` · plan snapshot ${g.planAsOf}` : ""} · ${g.nodes.length} nodes · ${g.edges.length} edges\n\n`;
  out += table(g.nodes, [
    { label: "Node", get: (n) => n.id },
    { label: "Kind", get: (n) => n.kind },
    { label: "Label", get: (n) => n.label },
    { label: "State", get: (n) => n.state ?? "" },
  ]);
  out += "\n" + table(g.edges, [
    { label: "From", get: (e) => e.from },
    { label: "Relation", get: (e) => e.kind },
    { label: "To", get: (e) => e.to },
    { label: "Label", get: (e) => e.label ?? "" },
  ]);
  return out + "\nTip: --dot for Graphviz, --mermaid for Markdown diagrams.\n";
}

function printPeople(r) {
  return `${r.range.start} to ${r.range.end}\n\n` + table(r.people, [
    { label: "ID", get: (p) => p.id },
    { label: "Name", get: (p) => p.name },
    { label: "Role", get: (p) => p.role },
    { label: "Updates", get: (p) => p.updates },
    { label: "Days", get: (p) => p.recordedDays },
    { label: "Projects", get: (p) => p.projectIds.join(", ") || "—" },
    { label: "Tasks", get: (p) => p.tasksOwned },
    { label: "Manages", get: (p) => p.manages || "" },
  ]) + "\nCounts describe record coverage, not effort or performance.\n";
}

function printPerson(r) {
  const p = r.person;
  let out = `${p.name} (${p.id}) · ${p.role} · ${p.groupId} · ${r.range.start} to ${r.range.end}\n`;
  if (p.reportsTo) out += `Reports to: ${p.reportsTo.name}\n`;
  if (p.manages.length) out += `Manages: ${p.manages.map((m) => m.name).join(", ")}\n`;
  if (r.headline) out += `\n${r.headline}\n${r.summary}\n`;
  out += "\nContributions\n" + table(r.contributions, [
    { label: "Date", get: (c) => c.date },
    { label: "Project", get: (c) => c.projectId },
    { label: "Contribution", get: (c) => c.description },
    { label: "Basis", get: (c) => c.basis },
    { label: "Update", get: (c) => c.title },
  ]);
  out += "\nDelivery tasks owned\n" + table(r.tasksOwned, [
    { label: "ID", get: (t) => t.id },
    { label: "Project", get: (t) => t.projectId },
    { label: "Task", get: (t) => t.title },
    { label: "Status", get: (t) => status[t.status] },
    { label: "Milestone", get: (t) => t.milestone },
    { label: "Blocker", get: (t) => t.blocker ?? "" },
  ]);
  if (r.nextSteps.length)
    out += "\nNext recorded steps\n" + r.nextSteps.map((s) => `  - [${s.projectId}] ${s.text}\n`).join("");
  if (r.collaborators.length) out += `\nWorking with: ${r.collaborators.map((c) => c.name).join(", ")}\n`;
  if (r.teamChanges.length)
    out += "\nTeam outcomes in scope\n" + table(r.teamChanges, [
      { label: "Date", get: (c) => c.date },
      { label: "Project", get: (c) => c.projectId },
      { label: "Update", get: (c) => c.title },
      { label: "Contributors", get: (c) => c.contributions.map((x) => x.personId).join(", ") },
    ]);
  return out;
}

function briefMarkdown(b) {
  const title = `${b.period[0].toUpperCase()}${b.period.slice(1)} brief · ${b.subject.name} · ${b.range.start}${b.range.end !== b.range.start ? ` – ${b.range.end}` : ""}`;
  const lines = [`# ${title}`, ""];
  lines.push(b.headline ? `**${b.headline}**` : "_No generated headline; derived facts only._", "");
  if (b.summary) lines.push(b.summary, "");
  const c = b.copy;
  if (c?.period === "weekly") {
    lines.push("## Themes");
    for (const t of c.themes) lines.push(`- **${t.title}** — ${t.text}`);
    if (c.carried.length) lines.push("", "## Carried into next week", ...c.carried.map((x) => `- ${x}`));
    if (c.outlook) lines.push("", "## Outlook", c.outlook);
    lines.push("");
  } else if (c?.period === "monthly") {
    lines.push("## How the month moved", c.arc, "");
    if (c.decisions.length) lines.push("## Decisions", ...c.decisions.map((d) => `- ${d.text}`), "");
    if (c.risks.length) lines.push("## Risks carried forward", ...c.risks.map((r) => `- ${r}`), "");
  } else if (c?.period === "yearly") {
    lines.push("## Quarter by quarter");
    for (const q of c.quarters) lines.push(`- **Q${q.quarter} · ${q.headline}** — ${q.text}`);
    if (c.lessons.length) lines.push("", "## Lessons", ...c.lessons.map((l) => `- ${l}`));
    lines.push("");
  }
  const d = b.digest;
  lines.push(`## Coverage (${d.unit}s)`);
  lines.push(
    "| " + d.slots.map((s) => s.label).join(" | ") + " |",
    "|" + d.slots.map(() => "---").join("|") + "|",
    "| " + d.slots.map((s) => (s.future ? "—" : s.changeIds.length || "·")).join(" | ") + " |",
    "",
  );
  if (d.streams.length) {
    lines.push("## Work streams");
    for (const s of d.streams)
      lines.push(`- **${s.last.title}** (${s.projectId}) · ${s.first.date} → ${s.last.date} · ${s.changeIds.length} update${s.changeIds.length === 1 ? "" : "s"} · ${s.last.basis}${s.openItems.length ? ` · open: ${s.openItems.join("; ")}` : ""}`);
    lines.push("");
  }
  if (d.milestoneMoves.length) {
    lines.push("## Milestone movement");
    for (const m of d.milestoneMoves) lines.push(`- ${m.projectId} · ${m.title}: ${m.from ? state[m.from] : "introduced"} → ${state[m.to]}${m.target ? ` (target ${m.target})` : ""}`);
    lines.push("");
  }
  if (d.sources.length) lines.push("## Records by source", ...d.sources.map((s) => `- ${s.source}: ${s.count}`), "");
  lines.push(`_${b.lineage.root.dailyIds.length} daily briefs · ${b.lineage.root.evidenceIds.length} linked records · ${b.generated ? "generated copy sealed to source revision" : "no generated copy for this period"}_`);
  return lines.join("\n") + "\n";
}

function printBrief(b) {
  let out = `${b.period} brief · ${b.subject.name} · ${b.range.start} to ${b.range.end} · ${b.generated ? "generated copy" : "derived only"}\n`;
  if (b.headline) out += `\n${b.headline}\n${b.summary}\n`;
  out += "\nCoverage: " + b.digest.slots.map((s) => `${s.label} ${s.future ? "—" : s.changeIds.length}`).join(" | ") + "\n";
  out += "\nWork streams\n" + table(b.digest.streams, [
    { label: "Project", get: (s) => s.projectId },
    { label: "Stream", get: (s) => s.last.title },
    { label: "From", get: (s) => s.first.date },
    { label: "To", get: (s) => s.last.date },
    { label: "Updates", get: (s) => s.changeIds.length },
    { label: "Basis", get: (s) => s.last.basis },
  ]);
  if (b.digest.milestoneMoves.length)
    out += "\nMilestone movement\n" + table(b.digest.milestoneMoves, [
      { label: "Project", get: (m) => m.projectId },
      { label: "Milestone", get: (m) => m.title },
      { label: "From", get: (m) => (m.from ? state[m.from] : "introduced") },
      { label: "To", get: (m) => state[m.to] },
      { label: "Target", get: (m) => m.target ?? "" },
    ]);
  return out + "\nTip: --md prints a Markdown brief, --json the full payload.\n";
}

function printEvidence(r) {
  const e = r.record;
  let out = `${e.title} (${e.id}) · ${e.source} · ${e.basis} · ${e.date}${e.restricted ? " · RESTRICTED (approved summary only)" : ""}\nProject: ${e.projectId}\n\n${e.summary}\n\nLimitation: ${e.limitation}\n`;
  if (e.items.length) out += "\n" + e.items.map((i) => `  - ${i}\n`).join("");
  if (e.criteria) out += "\nCriteria: " + Object.entries(e.criteria).map(([k, v]) => `${k}=${v}`).join(", ") + "\n";
  out += "\nCited by\n" + table(r.usedBy, [
    { label: "Date", get: (c) => c.date },
    { label: "Project", get: (c) => c.projectId },
    { label: "Update", get: (c) => c.title },
  ]);
  return out;
}

/* ---------- main ---------- */

async function main() {
  const { options, positional } = parseArgs(process.argv.slice(2));
  const [command, arg] = positional;
  if (options.help || !command) {
    process.stdout.write(HELP);
    process.exit(command ? 0 : 1);
  }
  const base = options.url ?? process.env.STRIDE_URL ?? "http://127.0.0.1:3100";
  const token = options.token ?? process.env.STRIDE_TOKEN;
  if (options.period && !PERIODS.has(options.period)) fail(`--period must be one of ${[...PERIODS].join(", ")}`);
  if (options.date && !/^\d{4}-\d{2}-\d{2}$/.test(options.date)) fail("--date must be YYYY-MM-DD");
  const emit = (body, render) => {
    process.stdout.write(options.json ? JSON.stringify(body, null, 2) + "\n" : render(body));
  };
  switch (command) {
    case "health":
      return emit(await get(base, token, "/api/health"), (b) => `${JSON.stringify(b)}\n`);
    case "workspace":
      return emit(await get(base, token, "/api/v1/workspace"), printWorkspace);
    case "projects":
      return emit(await get(base, token, "/api/v1/projects", { date: options.date, scope: options.scope }), printProjects);
    case "project":
      if (!arg) fail("Usage: stride project <id>");
      return emit(await get(base, token, `/api/v1/projects/${encodeURIComponent(arg)}`, { date: options.date }), printProject);
    case "graph":
      return emit(
        await get(base, token, arg ? `/api/v1/projects/${encodeURIComponent(arg)}/graph` : "/api/v1/graph", { date: options.date }),
        (g) => printGraph(g, options),
      );
    case "people":
      return emit(await get(base, token, "/api/v1/people", { date: options.date, period: options.period, scope: options.scope }), printPeople);
    case "person":
      if (!arg) fail("Usage: stride person <id>");
      return emit(await get(base, token, `/api/v1/people/${encodeURIComponent(arg)}`, { date: options.date, period: options.period }), printPerson);
    case "brief":
      return emit(
        await get(base, token, "/api/v1/briefs", {
          view: options.view,
          id: options.id ?? (options.view === "people" ? undefined : arg),
          scope: options.scope,
          period: options.period,
          date: options.date,
        }),
        (b) => (options.md ? briefMarkdown(b) : printBrief(b)),
      );
    case "evidence":
      if (!arg) fail("Usage: stride evidence <id>");
      return emit(await get(base, token, `/api/v1/evidence/${encodeURIComponent(arg)}`, { date: options.date }), printEvidence);
    case "openapi":
      return process.stdout.write(JSON.stringify(await get(base, token, "/api/v1/openapi.json"), null, 2) + "\n");
    default:
      fail(`Unknown command "${command}". Run stride --help.`);
  }
}

main().catch((error) => fail(error.message, 1));
