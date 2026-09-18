# STRIDE

A runnable Next.js reference for the approved, read-only STRIDE dashboard. Projects, people and progress, grounded in shared evidence—not activity scores.

This is an independently runnable frontend, **not a screenshot viewer**. It defaults to authored synthetic data and includes a validated snapshot adapter, a verified gateway-identity mode, server-side access grants and a read-only API. There is no live LLM, company connector, credential collection or write-back action. Company SSO and the target deployment still require environment-specific validation.

## Run locally

Use Node.js **22.13+** (Node 22 recommended).

```sh
git clone https://github.com/realAllenSong/stride_frontend.git
cd stride_frontend
nvm use
npm ci
npm run dev
```

Open **http://127.0.0.1:3100**. No API key or environment file is required. If you do not use nvm, install a compatible Node version directly.

For a production-mode preview:

```sh
npm run build
npm start
```

Stop the development server before starting production on the same port. The default scripts bind only to localhost. For containers and company integration, follow [deployment and identity setup](docs/deployment.md). External snapshot files are rejected unless gateway authorization is enabled.

## Try these paths

The latest fixture snapshot is **September 9, 2026**, not today's date. The default is its weekly view.

1. Open **Praetorian → View milestone evidence → View supporting records**. Inspect the local test, open PR and restricted underlying session. Press Escape to close; focus returns to the original control.
2. Switch **Daily / Weekly / Monthly / Yearly**, pick an older date or use the previous/next arrows. Open **From … daily briefs** to inspect the summary lineage.
3. Switch **People → Elena Novak**. Her own contributions and attributed team outcomes are separate; contributors remain named. Ethan demonstrates missing records without a negative judgment.
4. Open **Research Workbench** for notes-only progress. Open **Risk Data Checks → View Sep 4** for the last known update.
5. Open **Illustrative data** at the bottom of the sidebar to explore conflicting records and a delayed GitHub refresh.
6. Open **My view** for an optional workflow suggestion. This is a demo lens, **not an authenticated private area**.
7. Try the theme button, keyboard navigation, browser back/forward and a mobile-sized window.

All drilldowns are read-only. There are no fake Fix, Assign, Install or Prepare 1:1 actions. Sources are optional. Missing evidence is not evidence of missing work.

## A stable template, replaceable content

```text
Approved source summaries + optional notes + configured project goals
                                ↓
                   Validated daily brief JSON
                                ↓
                   Daily → weekly → monthly → yearly
                                ↓
                Scoped dashboard data + bounded copy
                                ↓
                     Fixed React components
```

The reference reducer preserves contributor IDs, original dates, evidence IDs and child-brief lineage. Repeated mentions of a work item are grouped, not counted as new outcomes. Manager rollups include the manager's own work plus the reporting tree, without transferring individual credit to the manager.

An optional `BriefCopy` supplies generated headings and summaries without controlling HTML or layout. The monthly Praetorian view includes an authored example. A SHA-256 source revision invalidates stale copy when a child or its evidence changes. No model is called by this repository; generation and scheduling belong behind the adapter.

See [data contract](docs/data-contract.md), [generation instructions](docs/generation-prompt.md), [view map](docs/view-map.md) and [security boundaries](SECURITY.md).

## Where to change things

| File                               | Responsibility                                                         |
| ---------------------------------- | ---------------------------------------------------------------------- |
| `src/lib/provider.ts`              | Server-only repository boundary; replace this with the company adapter |
| `src/lib/contracts.ts`             | Versioned brief schemas, bounded copy and typed entities               |
| `src/data/demo.ts`                 | All illustrative work, evidence and replaceable copy                   |
| `src/lib/briefs.ts`                | Scope, reporting hierarchy, time windows, deduplication and lineage    |
| `src/components/dashboard-app.tsx` | Sidebar, navigation, calendar, themes and loading transitions          |
| `src/components/views.tsx`         | Stable project, person, progress and suggestion templates              |
| `src/components/dialogs.tsx`       | Milestones, evidence, source context and lineage drilldowns            |
| `src/app/globals.css`              | Shared visual tokens and responsive layout                             |

Next.js App Router / React / TypeScript; Radix dialogs and popovers; DayPicker; Zod; Phosphor icons; self-hosted Geist. The visual system preserves the approved sage/forest palette, restrained depth and rounded cards. Text flows naturally within a fixed section hierarchy rather than being positioned over screenshots.

## Read-only API

```sh
curl 'http://127.0.0.1:3100/api/brief?view=projects&id=praetorian&period=monthly&date=2026-09-09'
```

The API returns the same typed, authorized `Dashboard` projection used by the page, including `root` and `lineage`. Invalid enum/date queries return 400; writes return 405. Responses are `private, no-store`. Demo mode serves public fixtures; gateway mode verifies identity and applies explicit server-owned grants before serialization. There is no CLI or MCP server in this frontend reference.

## Verify

```sh
npm run check
npm run build
npm run test:integration
npx playwright install chromium firefox webkit
npm run test:e2e
```

The suite covers date boundaries, provenance, malformed output, source gaps, manager attribution, navigation, dialogs, historical states, API behavior, dark/light accessibility and mobile overflow across Chromium, Firefox and WebKit. E2E tests reuse a server on port 3100 or start the **production build**. HTTP integration tests start a separate production server on port 3127. Screenshots and traces go to the OS temporary directory. Automated accessibility checks are not a substitute for a full assistive-technology audit.

## Before company integration

- Configure and verify the company's identity gateway, token issuer/audience/public key and explicit project/group grants. Both the page and API enforce the same server-owned permissions; URL filters are never permissions.
- Return only allowed, already-sanitized summaries from `BriefRepository`; never load raw prompts, DMs or credentials into the browser.
- Supply real server-owned identity mappings and dated source availability metadata. Demo scenario overrides are disabled in gateway mode.
- Publish validated snapshots atomically and regenerate ancestor copy when its source revision changes. The reducer is not a scheduling or ingestion service.
- Validate semantic support for generated claims, not just valid JSON. Failed generation should produce a qualified fallback, not a fabricated positive report.
- Implement retention, correction/deletion, audit and access policies before using real employee data.

This source is maintained separately from Verity in [realAllenSong/stride_frontend](https://github.com/realAllenSong/stride_frontend). Choose a distribution license before treating the repository as licensed open-source software.
