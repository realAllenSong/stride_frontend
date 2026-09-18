# Agent API and CLI

STRIDE exposes the same authorized, read-only projections to agents that it renders for people. There are no write operations. In gateway mode every endpoint verifies the bearer token and applies server-owned grants before anything is serialized; in demo mode the public fixture is served. An ID outside the caller's grant returns **403**, never a hint that it exists.

The contract is published at `GET /api/v1/openapi.json`.

## Endpoints

| Endpoint                          | Returns                                                                                      | Typical use                                        |
| --------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `GET /api/v1/workspace`           | Groups, people, projects, source availability, counts                                        | Orientation; resolve IDs                           |
| `GET /api/v1/projects`            | Every project with its current delivery gate, task counts, blockers and latest record        | "What is the state of everything?"                 |
| `GET /api/v1/projects/{id}`       | Plan snapshot (milestones, tasks, dependencies, runbooks), work streams, latest changes, evidence | Before touching a project you do not own          |
| `GET /api/v1/projects/{id}/graph` | Nodes and edges: project, milestones, tasks, dependencies, owners, resources, evidence, related projects | On-call: understand structure and who to ask   |
| `GET /api/v1/graph`               | Workspace graph: groups, projects, people, current gates, reporting lines, cross-project relations | The Obsidian-style map, as data                 |
| `GET /api/v1/people`              | People with record coverage for a period (updates, recorded days, projects, tasks owned)     | Who is attached to what                            |
| `GET /api/v1/people/{id}`         | Streams, contributions, owned tasks, next recorded steps, collaborators, reporting line      | Preparing a hand-off or a 1:1 without scores       |
| `GET /api/v1/briefs`              | Period brief: headline, bounded copy (weekly/monthly/yearly fields), digest, lineage         | Daily/weekly/monthly/yearly text for a chat agent  |
| `GET /api/v1/evidence/{id}`       | One record and the changes that cite it                                                      | Verify a claim                                     |
| `GET /api/brief`                  | Full dashboard projection used by the UI                                                     | Rendering or debugging the page                    |

Common parameters:

- `date` — as-of calendar date. Plans and evidence after this date are excluded; a future date is clamped to the latest snapshot. Later dates never reveal later results.
- `period` — `daily | weekly | monthly | yearly` (people and briefs).
- `scope` — group ID or `all`.

Restricted evidence is returned as its approved summary only. Raw prompts, sessions and private messages are never loaded by this application.

## Brief levels

Each period has a fixed template and bounded copy fields. A generator replaces the text; the shape does not change.

| Period  | Built from      | Copy fields beyond `headline` + `summary`           | Digest facts (always computed)                          |
| ------- | --------------- | --------------------------------------------------- | ------------------------------------------------------- |
| daily   | source records  | —                                                   | changes, sources                                        |
| weekly  | daily briefs    | `themes[]`, `carried[]`, `outlook`                  | 7 day slots, work streams, milestone moves, sources     |
| monthly | weekly briefs   | `arc`, `decisions[]`, `risks[]`                     | week slots with child headlines, streams, moves, sources |
| yearly  | monthly briefs  | `quarters[]`, `lessons[]`                           | 12 month slots, streams, moves, projects touched        |

Copy is only served when its `sourceRevision` matches the reducer's revision of the children it consumed. Correct a daily brief and every ancestor's copy is invalidated until regenerated; the digest keeps rendering from records in the meantime.

## CLI

`bin/stride.mjs` is a dependency-free Node client. After `npm ci` in this repository:

```sh
node bin/stride.mjs --help
node bin/stride.mjs projects
node bin/stride.mjs project praetorian --date 2026-09-05
node bin/stride.mjs graph praetorian --mermaid        # or --dot for Graphviz
node bin/stride.mjs people --period monthly
node bin/stride.mjs person zhiyuan
node bin/stride.mjs brief --id praetorian --period weekly --md
node bin/stride.mjs brief --view people --id elena --period monthly --json
node bin/stride.mjs evidence run-184
```

`npm link` (or `npm install -g .`) installs it as `stride`. Configuration:

| Setting        | Flag       | Environment    | Default                 |
| -------------- | ---------- | -------------- | ----------------------- |
| Server         | `--url`    | `STRIDE_URL`   | `http://127.0.0.1:3100` |
| Bearer token   | `--token`  | `STRIDE_TOKEN` | none (demo mode)        |
| Raw JSON       | `--json`   |                | tables                  |
| Markdown brief | `--md`     |                | (brief only)            |

Exit codes: `0` ok · `1` runtime error · `2` usage · `3` server/transport · `4` sign-in required · `5` access not granted.

## Agent recipes

**On-call, unfamiliar project**

```sh
stride project verity            # gate, tasks, blockers, runbooks
stride graph verity --mermaid    # who owns what, what depends on what
stride evidence verity-run       # check the claim behind the current state
```

**Weekly summary into a chat channel**

```sh
stride brief --period weekly --md            # portfolio
stride brief --id praetorian --period weekly --md
```

**Manager preparing a 1:1** — `stride person maya --period monthly`. The output lists records and owned tasks; it contains no score and should not be turned into one.

## Boundaries

- Read-only. The API cannot assign, close, install or notify.
- Coverage, not effort: counts describe which records exist, never how hard someone worked.
- Grants live on the server. A CLI flag or URL parameter can narrow a view; it cannot widen one.
- Bring your own scheduler and generator. This repository ships the contract, the reducer and the templates.
