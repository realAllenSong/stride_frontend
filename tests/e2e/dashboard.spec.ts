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
    page.getByRole("heading", { name: "This week, across projects." }),
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
    page.getByRole("heading", { name: "Two retry checks still need work." }),
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
  const trigger = page.getByRole("button", { name: "View milestone evidence" });
  await trigger.click();
  await expect(page.getByRole("dialog")).toContainText(
    "Changes reviewed and merged",
  );
  await page.screenshot({
    path: shot("milestone"),
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: "View supporting records", exact: true })
    .last()
    .click();
  await expect(page.getByRole("dialog")).toContainText("Local test run #184");
  await page.screenshot({
    path: shot("evidence"),
    fullPage: true,
    animations: "disabled",
  });
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
    page.getByRole("heading", { name: "This week’s changes." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Monthly", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Choose historical date" }),
  ).toContainText("September 2026");
  await expect(
    page.getByRole("heading", {
      name: "Retry recovery reached local validation.",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Yearly", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "2026 · available history" }),
  ).toBeVisible();
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
      name: "Bounded retry changes drafted",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole("main")).not.toContainText("6 / 8 passed");
  await page.getByRole("button", { name: "Choose historical date" }).click();
  await expect(page.getByRole("grid")).toBeVisible();
  await page.getByRole("button", { name: "Latest demo snapshot" }).click();
  await expect(
    page.getByRole("heading", { name: "Two retry checks still need work." }),
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
      name: "Bounded retry changes drafted",
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "Bounded retry changes drafted",
      exact: true,
    }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Two retry checks still need work." }),
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
    page.getByRole("heading", { name: "Own contributions" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Team outcomes" }),
  ).toBeVisible();
  await expect(page.getByRole("main")).toContainText("Zhiyuan Song:");
  await expect(page.getByRole("main")).toContainText("Marcus Lee:");
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
    page.getByRole("heading", {
      name: "The latest result needs clarification.",
    }),
  ).toBeVisible();
  await page.goto("/?id=praetorian&period=daily&scenario=delayed");
  await expect(
    page.getByText("GitHub refresh delayed. Last snapshot: Sep 8."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Details", exact: true }).click();
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
    page.getByRole("heading", { name: "Two retry checks still need work." }),
  ).toBeVisible();
  await page.screenshot({
    path: shot("mobile"),
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "View milestone evidence" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Close details" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
