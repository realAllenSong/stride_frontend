# Security and privacy boundaries

The default application is a **public synthetic-data reference**. Gateway mode adds verified identity and explicit project/group access control for an approved snapshot adapter. A live employee-data deployment still needs company SSO, privacy policy and infrastructure validation. Fixture names are illustrative labels; work and records are not imported from company systems.

## Included safeguards

- No credentials, raw agent transcripts, source code, email bodies or private DMs are collected.
- Plain text is escaped by React; generated HTML is not accepted by the brief schemas.
- The repository boundary is server-only. Private coaching payloads are omitted from manager-view DTOs in the demo.
- The read-only API validates query dates/enums and does not accept mutations.
- Dialogs identify source limitations and distinguish reported claims from observed results.
- Production headers disable framing and content sniffing. Nonce-based CSP restricts scripts without `unsafe-eval`; inline styles are allowed for Radix positioning. Dynamic pages and APIs are not shared-cacheable.
- RS256 signature, issuer, audience, expiry and token age are checked before workspace access. Server-owned grants filter records before SSR/RSC/API serialization. `view=self` uses the authenticated identity, never the query ID.
- Complete snapshots undergo strict schema/reference validation with a 20 MiB file bound. External snapshots fail closed in demo mode; bad configurations and malformed snapshots do not fall back to public access.

## Two explicit modes

Every fixture is public within **demo mode**. Anyone can select any demo person, group or `view=self`. This is not a private account. In **gateway mode**, both pages and API require a verified token, records are filtered to server-owned project/group grants, and personal suggestions are further filtered to the authenticated subject. Shared project access includes contributor/owner directory information and approved shared notes. The reporting hierarchy does not grant privileges. See [deployment](docs/deployment.md) for the policy contract.

Before connecting real data, verify the actual company gateway and its header stripping/forwarding, TLS, key rotation, access grants, rate limits, retention, audit and deletion policies. One deployment serves one workspace; multi-tenant hosting is not implemented. Upstream summaries must already be approved/redacted: schema validation cannot find a secret embedded in a prose field. Never reuse another product's credentials by reading local settings without explicit authorized integration.

For local demonstrations, keep the default loopback binding. Do not expose real data in demo mode. Review dependency updates and run the existing tests before deployment. UI, access-control and automated accessibility tests are not a penetration test or certification of a company deployment.

## Reporting

No private security reporting channel has been configured yet. The repository owner should add one and choose a distribution license before public release. Do not post private company data in a public issue or pull request.
