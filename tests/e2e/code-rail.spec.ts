import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { waitForAppReady } from "./app-ready";

// Creates an isolated workspace + code channel and returns the expanded rail
// locator. Rail behaviour (collapse, settings popover) is independent of room
// mode, so this leaves the channel on its default mode.
async function createCodeChannel(page: Page) {
  await page.goto("/app");
  await waitForAppReady(page);

  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const workspaceResponse = await page.request.post("/api/workspaces", {
    data: { name: `Rail ${suffix}` },
  });
  expect(workspaceResponse.ok()).toBe(true);
  const { workspace } = (await workspaceResponse.json()) as {
    workspace: { id: string; route_id: string };
  };
  await page.goto(`/app/${workspace.route_id}`);
  await waitForAppReady(page);

  await page.getByRole("button", { name: "Create channel" }).click();
  const dialog = page.locator(".profile-modal", {
    has: page.getByRole("heading", { name: "Create channel" }),
  });
  await dialog.getByLabel("Channel name").fill(`code-rail-${suffix}`);
  await dialog.getByRole("radio", { name: /^Code/ }).check();

  const created = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      /\/api\/workspaces\/[^/]+\/channels$/.test(new URL(response.url()).pathname),
  );
  await dialog.getByRole("button", { name: "Create channel" }).click();
  expect((await created).ok()).toBe(true);

  const rail = page.getByRole("complementary", { name: "Code workspace", exact: true });
  await expect(rail).toBeVisible();
  return rail;
}

test("code rail collapses, restores, persists per user, and isolates across users", async ({
  page,
}) => {
  const rail = await createCodeChannel(page);
  const surface = page.locator(".conversation-surface.has-code-rail");

  // Starts expanded.
  await expect(surface).not.toHaveClass(/code-rail-collapsed/);
  await rail.getByRole("button", { name: "Collapse code workspace" }).click();

  // Collapsed: narrow icon strip, canvas reclaims the freed width (46px column).
  await expect(surface).toHaveClass(/code-rail-collapsed/);
  const collapsedRail = page.getByRole("complementary", { name: "Code workspace (collapsed)" });
  await expect(collapsedRail).toBeVisible();
  await expect(collapsedRail.getByRole("button", { name: "Expand code workspace" })).toBeVisible();
  const collapsedCols = await surface.evaluate((el) => getComputedStyle(el).gridTemplateColumns);
  expect(collapsedCols.trim().endsWith("46px")).toBe(true);

  // Preference is persisted under a per-user localStorage key.
  const meResponse = await page.request.get("/api/me");
  expect(meResponse.ok()).toBe(true);
  const { user } = (await meResponse.json()) as { user: { id: string } };
  const key = `clickclack:code-rail-collapsed:v1:${user.id}`;
  expect(await page.evaluate((k) => window.localStorage.getItem(k), key)).toBe("1");

  // Survives a full reload.
  await page.reload();
  await waitForAppReady(page);
  await expect(
    page.getByRole("complementary", { name: "Code workspace (collapsed)" }),
  ).toBeVisible();

  // Cross-user isolation: a different user's key is untouched by this user's
  // restore, and this user's restore clears only its own key.
  await page.evaluate(() =>
    window.localStorage.setItem("clickclack:code-rail-collapsed:v1:foreign-user", "1"),
  );
  await page
    .getByRole("complementary", { name: "Code workspace (collapsed)" })
    .getByRole("button", { name: "Expand code workspace" })
    .click();
  await expect(
    page.getByRole("complementary", { name: "Code workspace", exact: true }),
  ).toBeVisible();
  expect(await page.evaluate((k) => window.localStorage.getItem(k), key)).toBeNull();
  expect(
    await page.evaluate(() =>
      window.localStorage.getItem("clickclack:code-rail-collapsed:v1:foreign-user"),
    ),
  ).toBe("1");
});

test("channel settings popover: focus moves in, Escape restores focus, outside click dismisses", async ({
  page,
}) => {
  const rail = await createCodeChannel(page);
  const gear = rail.getByRole("button", { name: "Channel settings" });
  const dialog = rail.getByRole("dialog", { name: "Channel settings" });

  // Open: focus moves INTO the dialog so its own Escape handler receives keys.
  await gear.click();
  await expect(dialog).toBeVisible();
  await expect(dialog).toBeFocused();

  // Escape closes and restores focus to the gear trigger.
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(gear).toBeFocused();

  // Reopen, then a pointer click on a non-focusable outside surface dismisses.
  await gear.click();
  await expect(dialog).toBeVisible();
  await page.getByLabel("Message body").click();
  await expect(dialog).toBeHidden();
});

test("rail collapse is a desktop affordance; below 1100px it stays a top bar", async ({ page }) => {
  const rail = await createCodeChannel(page);
  const surface = page.locator(".conversation-surface.has-code-rail");

  await rail.getByRole("button", { name: "Collapse code workspace" }).click();
  await expect(surface).toHaveClass(/code-rail-collapsed/);

  // Desktop default viewport: collapsed rail is the narrow 46px side column.
  const desktopCols = await surface.evaluate((el) => getComputedStyle(el).gridTemplateColumns);
  expect(desktopCols.trim().split(/\s+/)).toHaveLength(2);
  expect(desktopCols.trim().endsWith("46px")).toBe(true);

  // Below the 1100px breakpoint the collapsed rail must revert to a single-column
  // top bar instead of a 46px side strip, and must not induce horizontal scroll.
  await page.setViewportSize({ width: 900, height: 800 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  const narrowCols = await surface.evaluate((el) => getComputedStyle(el).gridTemplateColumns);
  expect(narrowCols.trim().split(/\s+/)).toHaveLength(1);
  await expect(page.getByLabel("Message body")).toBeVisible();
});
