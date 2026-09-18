# Deployment and identity boundary

## Run the verified application build

Use Node 22.13 or newer. Run `npm ci`, `npm run check`, `npm run build`, then `npm start`. The local scripts bind to `127.0.0.1:3100`. `GET /api/health` is a minimal **liveness** endpoint, not proof that an identity provider or data adapter is healthy.

The default mode contains only authored, public synthetic examples. `docker compose up --build` provides the same loopback-only demo in a non-root, read-only container. Stop any other server on port 3100 first. Docker must be running. The Dockerfile uses Next.js standalone output; the normal local build continues to use `next start`.

For a cluster, build the image, mount approved snapshots and public verification configuration read-only, and expose port 3100 **only behind the firm's identity gateway**. Provide TLS, rate/size limits, trusted proxy configuration and network policy there. Do not expose an unauthenticated employee-data service publicly. Do not use a shared CDN cache for HTML, RSC or `/api/brief`; only hashed static assets may be public-cacheable.

## Gateway mode

This application implements the resource-server boundary, not a login provider. The gateway handles company sign-in and session cookies, strips client-supplied identity/Authorization headers, and forwards a short-lived signed token on **every** document, navigation/RSC and API request. No bearer token is stored in browser JavaScript.

Set these server-only variables (see `.env.example`):

| Variable | Meaning |
| --- | --- |
| `STRIDE_AUTH_MODE=gateway` | Enforce verified identity and explicit access grants |
| `STRIDE_JWT_PUBLIC_KEY_FILE` | Read-only SPKI PEM public key used to verify RS256 tokens |
| `STRIDE_JWT_ISSUER` | Exact expected issuer |
| `STRIDE_JWT_AUDIENCE` | Exact expected audience |
| `STRIDE_ACCESS_POLICY_FILE` | Server-owned JSON policy; never editable by a client request |
| `STRIDE_WORKSPACE_FILE` | Optional approved Workspace JSON, max 20 MiB; omitted means synthetic fixture |

Tokens require `sub`, `iat`, `exp`, the configured `iss`/`aud`, a valid RS256 signature and an age no greater than one hour. Clock tolerance is five seconds. Each request reads the public key and policy, so updates take effect without a restart. Pinned-key rotation must be coordinated with the issuer; automatic JWKS rotation is not implemented.

Example policy (replace identities with exact, stable issuer subjects):

```json
{
  "principals": [
    { "subject": "directory-subject-1", "personId": "zhiyuan", "groupIds": [], "projectIds": ["praetorian"] },
    { "subject": "directory-subject-2", "personId": "elena", "groupIds": ["infra", "quant", "risk"], "projectIds": [] }
  ]
}
```

An explicit project grant shares that project's approved updates, evidence, configured goals and contributor/owner names. A group grant additionally shares all projects and member directory entries in that group. There are no inferred privileges from `reportsTo`; the hierarchy organizes views only. No grants means no project data. Coaching is filtered to the verified person's ID and never returned in manager-view DTOs. URL parameters cannot impersonate another user or grant access. Unknown subjects and unauthorized targets fail closed. This is a single-workspace service, not multi-tenant SaaS.

Both the page and API call the same authenticated loader. The API returns 401, 403 or 503 without data on failure; the page shows a safe access/unavailable screen. Proxy middleware supplies CSP headers, **not** the authorization decision.

## Snapshot publishing

Validate `WorkspaceSchema` and `validateReferences` before publishing. Write a new file and atomically rename it over the configured snapshot path, rather than updating JSON in place. Each request reads a fresh bounded snapshot; a page refresh or navigation sees the latest data. There is no background ingestion, model call, scheduling service or push subscription in this frontend.

Inputs are **already-approved shared summaries**, not an automatic redaction service. The schema rejects raw fields but cannot detect secrets embedded in ordinary prose. Redaction, consent, semantic grounding, retention, correction/deletion and permission review belong in the upstream service and deployment policy. Do not put raw sessions, DMs, credentials or private employee notes into the shared snapshot.

The aggregate revision hash changes when child content or evidence changes. Old generated period copy is omitted unless its `sourceRevision` still matches. Publishing fresh, grounded weekly/monthly/yearly copy remains the generation service's job.

## Release verification

```sh
npm run check
npm run build
npm run test:integration
npx playwright install chromium firefox webkit
npm run test:e2e
npm audit
```

The integration tests start an isolated loopback production server on port 3127 with temporary synthetic data and an ephemeral test signing key. They cover SSR/API denial, RSC payloads, explicit grants, self impersonation attempts, malformed snapshots and recovery. They do **not** connect to a real company SSO system. Cross-browser tests cover Chromium, Firefox and WebKit, including narrow viewports and keyboard focus.

Before company release, test the actual gateway's sign-in, expiry/logout, RSC forwarding, TLS, public-key rotation, configured grants and production traffic limits. Exercise container startup/shutdown and health monitoring in the target cluster. Confirm a distribution license and security contact before publishing the repository.
