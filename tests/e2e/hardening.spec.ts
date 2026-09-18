import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("theme persists across reload, navigation and browser history", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Use dark theme" }).click();
  await page
    .getByRole("button", { name: "Open Praetorian", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "Two retry checks still need work." })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading", { name: "This week, across projects." })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Use light theme" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Use light theme" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Open Praetorian", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Use light theme" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "View milestone evidence" }).click();
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "This week, across projects." }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goForward();
  await expect(
    page.getByRole("heading", { name: "Two retry checks still need work." }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("calendar boundaries stay navigable and do not jump to demo history", async ({
  page,
}) => {
  await page.goto("/?period=yearly&date=2000-01-01");
  await expect(
    page.getByRole("button", { name: "Previous period" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Choose historical date" }).click();
  await expect(page.getByRole("grid")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.goto("/?period=monthly&date=2100-12-31");
  await expect(
    page.getByRole("button", { name: "Next period" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Choose historical date" }),
  ).toContainText("December 2100");
});
test("keyboard focus stays within details and returns to its trigger", async ({
  page,
}) => {
  await page.goto("/?id=praetorian");
  const trigger = page.getByRole("button", { name: "View milestone evidence" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Tab");
    expect(
      await page
        .getByRole("dialog")
        .evaluate((node) => node.contains(document.activeElement)),
    ).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});
test("source state, context and all project cards have useful details", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (e) => {
    if (e.type() === "error") errors.push(e.text());
  });
  for (const name of [
    "Praetorian",
    "STRIDE",
    "Verity",
    "Research Workbench",
    "Risk Data Checks",
  ]) {
    await page.goto("/");
    await page
      .getByRole("button", { name: `Open ${name}`, exact: true })
      .click();
    await expect(page.getByRole("main")).toContainText(name);
    await expect(page.getByRole("main").locator("h1")).not.toBeEmpty();
    await page
      .locator("footer")
      .getByRole("button", { name: "Sources & freshness", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toContainText(
      "Missing records do not mean missing work",
    );
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Progress", exact: true }).click();
    await expect(page.getByRole("main").locator("h1")).not.toBeEmpty();
  }
  expect(errors).toEqual([]);
});
test("every people tab renders, including sparse histories", async ({
  page,
}) => {
  for (const person of [
    "elena",
    "zhiyuan",
    "maya",
    "marcus",
    "ethan",
    "priya",
  ]) {
    await page.goto(`/?view=people&id=${person}`);
    for (const tab of ["Brief", "Contributions", "Progress"]) {
      await page.getByRole("button", { name: tab, exact: true }).click();
      await expect(page.getByRole("main").locator("h1")).not.toBeEmpty();
      await expect(page.locator(".page-content")).toHaveAttribute(
        "aria-busy",
        "false",
      );
    }
  }
});
test("dark dialog and calendar pass automated accessibility with reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?id=praetorian");
  await page.getByRole("button", { name: "Use dark theme" }).click();
  await page.getByRole("button", { name: "View milestone evidence" }).click();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Choose historical date" }).click();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});
