# Prototype to running views

The approved image prototype is implemented as reusable templates and actual state transitions, not 22 independent hard-coded pages. Query state is shareable and supports browser history. The examples below are paths relative to the local host.

| View or interaction                   | Route / entry                                                       |
| ------------------------------------- | ------------------------------------------------------------------- |
| Portfolio                             | `/`                                                                 |
| Group selection and filtered projects | Sidebar group popover; `/?scope=infra`                              |
| Project overview                      | `/?id=praetorian&period=daily`                                      |
| Milestone evidence                    | Project → View milestone evidence                                   |
| Evidence drawer                       | Project → View supporting records                                   |
| Individual / restricted record        | Evidence drawer → a record or restricted-session link               |
| Calendar and historical date          | Header date popover; `/?id=praetorian&period=daily&date=2026-09-08` |
| Project delivery board                | `/?id=praetorian` (Delivery tab: gates, task board, exit criteria)  |
| Project context map                   | `/?id=praetorian&tab=context`                                       |
| Daily brief template                  | `/?id=praetorian&tab=progress&period=daily`                         |
| Weekly brief template                 | `/?id=praetorian&tab=progress&period=weekly` (day strip, themes, streams, milestone moves) |
| Monthly brief template                | `/?id=praetorian&tab=progress&period=monthly` (week rows, arc, decisions, risks) |
| Yearly brief template                 | `/?id=praetorian&tab=progress&period=yearly` (month grid, quarters, lessons) |
| Portfolio brief at any grain          | `/?tab=progress&period=monthly`                                     |
| Summary lineage                       | Footer → From … daily briefs                                        |
| People directory                      | `/?view=people` (cards: latest contribution, day dots, projects, tasks) |
| Person brief                          | `/?view=people&id=zhiyuan` (facts, focus bar, contributions, tasks owned) |
| Attributed contributions              | `/?view=people&id=zhiyuan&tab=contributions`                        |
| Person period brief                   | `/?view=people&id=zhiyuan&tab=progress&period=monthly`              |
| Manager own work + team board         | `/?view=people&id=elena`                                            |
| Agent API                             | `/api/v1/openapi.json`, `/api/v1/projects/praetorian/graph`; CLI `node bin/stride.mjs --help` |
| Self / suggestions                    | Sidebar → My view; `/?view=self&tab=suggestions`                    |
| Notes-only work                       | `/?id=research&period=daily`                                        |
| No new records                        | `/?id=risk&period=daily`                                            |
| Missing person update                 | `/?view=people&id=ethan`                                            |
| Conflicting evidence                  | `/?id=praetorian&period=daily&scenario=conflict`                    |
| Delayed source refresh                | `/?id=praetorian&period=daily&scenario=delayed`                     |
| Local test, no deployment claim       | `/?id=verity&date=2026-09-08&period=daily`                          |
| Shared note and support request       | `/?id=stride&period=daily`                                          |
| Loading snapshot                      | Shown during route transitions; old body content is not reused      |
| Sources and freshness                 | Footer → Sources & freshness                                        |
| Goal list                             | Portfolio → View project context                                    |
| Demo explanation / edge cases         | Sidebar → Illustrative data                                         |

## Intentional implementation differences

- Typography reflows with real content; the image's exact line breaks are not hard-coded.
- The default weekly view includes Verity's September 8 update. September 9 **daily** correctly shows no new update and a dated last-known record instead of relabeling it.
- The person view also offers Progress for historical drilldown. Manager own work and team outcomes are separated explicitly.
- Light/dark mode, mobile navigation, focus trapping, Escape and reduced-motion preferences are functional.
- Actions are view-only. Suggestions do not install a tool or update a remote system.
- The demo freely permits switching people/scopes. That is not production authorization.

## Keep these invariants when replacing data

Preserve section order and the visual tokens. Use headline, summary, evidence and optional detail fields rather than model-generated markup. Omit unsupported context. Avoid adding a permanent card for every possible source. Full evidence lives in a drawer or dialog so the main page remains a concise explanation of the work.
