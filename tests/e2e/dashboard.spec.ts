import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { tmpdir } from "node:os";
import { join } from "node:path";
const shot = (name: string) => join(tmpdir(), `stride-next-${name}.png`);
test("portfolio renders and every project opens a real detail page", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type()))
      errors.push(message.text());
  });
  await page.goto("/");
  await expect(page).toHaveTitle(/STRIDE/);
  await expect(page.locator("nextjs-portal [data-nextjs-dialog]")).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("heading", { name: "Retry validation and pilot preparation led the week." }),
  ).toBeVisible();
  for (const name of [
    "Praetorian",
    "STRIDE",
    "Verity",
    "Research Workbench",
    "Risk Data Checks",
  ]) {
    await expect(
      page.getByRole("button", { name: `Open ${name}`, exact: true }),
    ).toBeVisible();
  }
  await page.screenshot({
    path: shot("portfolio"),
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: "Open Praetorian", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Two recovery checks remain before release review." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Weekly", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Daily", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Choose historical date" }),
  ).toContainText("Sep 9, 2026");
  await page.screenshot({
    path: shot("project"),
    fullPage: true,
    animations: "disabled",
  });
  expect(errors).toEqual([]);
});
test("milestone, evidence and restricted record drilldowns", async ({
  page,
}) => {
  await page.goto("/?id=praetorian&period=daily");
  const trigger = page.getByRole("button", { name: /Open PRT-102:/ });
  await trigger.click();
  await expect(page.getByRole("dialog")).toContainText(
    "Bound timeout recovery",
  );
  await page.screenshot({
    path: shot("milestone"),
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: /Local test run #184/ })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Local test run #184");
  await page.screenshot({
    path: shot("evidence"),
    fullPage: true,
    animations: "disabled",
  });
  await page.keyboard.press("Escape");
  await trigger.click();
  await page.getByRole("button", { name: /Approved session summary/ }).click();
  await page
    .getByRole("button", {
      name: "Underlying record is restricted",
      exact: true,
    })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Raw prompts, responses and private messages are not loaded",
  );
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
test("period switches preserve context and summary lineage drills down", async ({
  page,
}) => {
  await page.goto("/?id=praetorian&tab=progress&period=weekly");
  await expect(
    page.getByRole("heading", {
      name: "Bounded retries reached a local test run; two checks still fail.",
    }),
  ).toBeVisible();
  // Weekly template: a day strip, themes and carried items.
  await expect(page.getByRole("region", { name: "Records by day" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Mon: 1 updates" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sun: not yet" })).toBeDisabled();
  await expect(page.getByRole("heading", { name: "Review is now the constraint" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Carried into next week" })).toBeVisible();
  await page.getByRole("button", { name: "Monthly", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Choose historical date" }),
  ).toContainText("September 2026");
  await expect(
    page.getByRole("heading", {
      name: "Retry recovery reached local validation.",
    }),
  ).toBeVisible();
  // Monthly template: week rows carrying the weekly headlines, decisions and risks.
  await expect(page.getByRole("heading", { name: "How the month moved" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Week by week" })).toBeVisible();
  await expect(page.getByRole("main")).toContainText(
    "Bounded retries reached a local test run; two checks still fail.",
  );
  await expect(page.getByRole("heading", { name: "Risks carried forward" })).toBeVisible();
  await page.getByRole("button", { name: "Yearly", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "From incident catalogue to a retry fix under local test.",
    }),
  ).toBeVisible();
  // Yearly template: twelve months, quarters and lessons.
  await expect(page.getByRole("region", { name: "Records by month" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Jun/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Dec/ })).toBeDisabled();
  await expect(page.getByRole("heading", { name: "Reproduced, then implemented" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Lessons recorded" })).toBeVisible();
  // Drill from a month cell into the monthly template.
  await page.getByRole("button", { name: /^Aug/ }).click();
  await expect(
    page.getByRole("button", { name: "Monthly", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("heading", {
      name: "The flaky retry failure was reproduced, then investigated.",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Yearly", exact: true }).click();
  await page.getByRole("button", { name: "View summary lineage" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Original dates, contributors and evidence stay attached",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Sep 1 - Sep 30/ })
    .click();
  await expect(
    page.getByRole("button", { name: "Monthly", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});
test("calendar and previous period use actual historical records", async ({
  page,
}) => {
  await page.goto("/?id=praetorian&period=daily&date=2026-09-09");
  await page.getByRole("button", { name: "Previous period" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Retry changes are drafted. Validation is next.",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole("main")).not.toContainText("6 / 8 passed");
  await page.getByRole("button", { name: "Choose historical date" }).click();
  await expect(page.getByRole("grid")).toBeVisible();
  await page.getByRole("button", { name: "Latest demo snapshot" }).click();
  await expect(
    page.getByRole("heading", { name: "Two recovery checks remain before release review." }),
  ).toBeVisible();
});
test("group scope and search filter navigation without rankings", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Choose group" }).click();
  await page
    .getByRole("button", { name: "Quant Research", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Open Research Workbench", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Open Praetorian", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("textbox", { name: "Find a project" })
    .fill("no-such-project");
  await expect(page.getByText("No matches. Try another name.")).toBeVisible();
});
test("calendar selection survives reload and browser back", async ({
  page,
}) => {
  await page.goto("/?id=praetorian&period=daily&date=2026-09-09");
  await page.getByRole("button", { name: "Choose historical date" }).click();
  await page
    .getByRole("grid")
    .getByRole("button", { name: "Tuesday, September 8th, 2026", exact: true })
    .click();
  await expect(page).toHaveURL(/date=2026-09-08/);
  await expect(
    page.getByRole("heading", {
      name: "Retry changes are drafted. Validation is next.",
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "Retry changes are drafted. Validation is next.",
      exact: true,
    }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Two recovery checks remain before release review." }),
  ).toBeVisible();
});
test("historical goals do not expose later configured milestones", async ({
  page,
}) => {
  await page.goto("/?period=daily&date=2026-08-01");
  await page
    .getByRole("button", { name: "View project context", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "No project-defined goals were configured in this snapshot.",
  );
  await expect(page.getByRole("dialog")).not.toContainText(
    "Preserve review findings",
  );
});
test("people, own contributions and attributed team outcomes", async ({
  page,
}) => {
  await page.goto("/?view=people&id=elena&period=weekly");
  await expect(
    page.getByRole("heading", {
      name: "Team reached two local validations; pilot selection is the open ask.",
    }),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "Period facts" })).toBeVisible();
  await expect(page.getByRole("main")).toContainText("Delivery tasks owned");
  await expect(
    page.getByRole("heading", { name: "Own contributions" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Team outcomes" }),
  ).toBeVisible();
  await expect(page.getByRole("main")).toContainText("Zhiyuan Song:");
  await expect(page.getByRole("main")).toContainText("Marcus Lee:");
  await expect(page.getByRole("main")).not.toContainText(/score|ranking/i);
  await page.getByRole("button", { name: /STD-204/ }).click();
  await expect(page.getByRole("dialog")).toContainText("Review the first week of feedback");
  await page.keyboard.press("Escape");
  await page.screenshot({
    path: shot("manager"),
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("navigation", { name: "People", exact: true })
    .getByRole("button", { name: "Ethan Brooks", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "No shared update in this period" }),
  ).toBeVisible();
  await expect(page.getByRole("main")).toContainText(
    "No performance conclusion is drawn",
  );
});
test("people directory cards and the daily template stay factual", async ({
  page,
}) => {
  await page.goto("/?view=people");
  await expect(
    page.getByRole("heading", { name: "Shared work, person by person." }),
  ).toBeVisible();
  const zhiyuan = page.getByRole("main").getByRole("button", { name: /Zhiyuan Song/ });
  await expect(zhiyuan).toContainText("Added bounded retry handling");
  await expect(page.getByRole("main").getByRole("button", { name: /Ethan Brooks/ })).toContainText(
    "No shared update in this period",
  );
  await zhiyuan.click();
  await expect(page.getByRole("region", { name: "Period facts" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Focus this period" })).toBeVisible();
  await page.getByRole("button", { name: "Praetorian", exact: true }).first().click();
  await expect(page).toHaveURL(/view=projects/);
  await page.goto("/?id=praetorian&tab=progress&period=daily");
  await expect(page.getByRole("heading", { name: "What changed" })).toBeVisible();
  await expect(page.getByRole("main")).toContainText("Next recorded steps");
  await page.getByRole("button", { name: "See the whole week" }).click();
  await expect(
    page.getByRole("button", { name: "Weekly", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});
test("notes-only and stale snapshots remain explicitly qualified", async ({
  page,
}) => {
  await page.goto("/?id=research&period=daily");
  await expect(
    page.getByText("Research work, captured in a note."),
  ).toBeVisible();
  await page.getByRole("button", { name: "View note context" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Compared two indexing approaches",
  );
  await page.keyboard.press("Escape");
  await page.goto("/?id=risk&period=daily");
  await expect(
    page.getByRole("heading", { name: "No new update for this period." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "View Sep 4", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Choose historical date" }),
  ).toContainText("Sep 4, 2026");
});
test("self suggestions stay separate from the shared brief", async ({
  page,
}) => {
  await page.goto("/?view=people&id=zhiyuan&period=weekly");
  await expect(
    page.getByRole("button", { name: "Suggestions", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "My view", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "One idea for your next review." }),
  ).toBeVisible();
  await expect(page.getByRole("main")).toContainText(
    "production authorization is not connected",
  );
});
test("source conflict and delayed refresh scenarios are inspectable", async ({
  page,
}) => {
  await page.goto("/?id=praetorian&period=daily&scenario=conflict");
  await expect(
    page.getByText("The latest result needs clarification.", { exact: true }),
  ).toBeVisible();
  await page.goto("/?id=praetorian&period=daily&scenario=delayed");
  await expect(
    page.getByText("GitHub refresh delayed. Last snapshot: Sep 8."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Compare records", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "current PR state is unknown",
  );
});
test("read-only API validates dates and returns traceable data", async ({
  request,
}) => {
  const good = await request.get("/api/brief?period=yearly&id=praetorian");
  expect(good.ok()).toBe(true);
  const body = await good.json();
  expect(body.root.period).toBe("yearly");
  expect(body.root.dailyIds.length).toBeGreaterThan(0);
  expect(body.digest.slots).toHaveLength(12);
  const projects = await (await request.get("/api/v1/projects")).json();
  expect(projects.projects).toHaveLength(5);
  const graph = await (
    await request.get("/api/v1/projects/praetorian/graph?date=2026-09-05")
  ).json();
  expect(graph.planAsOf).toBe("2026-09-04");
  expect(graph.nodes.some((n: { id: string }) => n.id === "task:PRT-102")).toBe(false);
  const brief = await (await request.get("/api/v1/briefs?period=weekly")).json();
  expect(brief.headline).toBe("Retry validation and pilot preparation led the week.");
  expect((await request.get("/api/v1/projects/nope")).status()).toBe(404);
  expect((await request.get("/api/v1/people?period=hourly")).status()).toBe(400);
  const openapi = await (await request.get("/api/v1/openapi.json")).json();
  expect(openapi.openapi).toBe("3.1.0");
  const bad = await request.get("/api/brief?date=2026-02-30");
  expect(bad.status()).toBe(400);
  const write = await request.post("/api/brief", { data: {} });
  expect(write.status()).toBe(405);
});
test("desktop and dark surfaces pass accessibility checks", async ({
  page,
}) => {
  await page.goto("/");
  const light = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(light.violations).toEqual([]);
  await page.getByRole("button", { name: "Use dark theme" }).click();
  const dark = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(dark.violations).toEqual([]);
  await page.screenshot({
    path: shot("dark"),
    fullPage: true,
    animations: "disabled",
  });
});
test("mobile navigation, detail sheet and overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Praetorian", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Two recovery checks remain before release review." }),
  ).toBeVisible();
  await page.screenshot({
    path: shot("mobile"),
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Exit criteria" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Close details" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
