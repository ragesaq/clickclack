import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { waitForAppReady } from "./app-ready";

test("code channels switch between single-user and multi-user rooms durably", async ({ page }) => {
  await page.goto("/app");
  await waitForAppReady(page);

  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const workspaceResponse = await page.request.post("/api/workspaces", {
    data: { name: `Code mode ${suffix}` },
  });
  expect(workspaceResponse.ok()).toBe(true);
  const { workspace: isolatedWorkspace } = (await workspaceResponse.json()) as {
    workspace: { route_id: string };
  };
  await page.goto(`/app/${isolatedWorkspace.route_id}`);
  await waitForAppReady(page);

  const channelName = `code-mode-${suffix}`;
  await page.getByRole("button", { name: "Create channel" }).click();
  const dialog = page.locator(".profile-modal", {
    has: page.getByRole("heading", { name: "Create channel" }),
  });
  await dialog.getByLabel("Channel name").fill(channelName);
  await dialog.getByRole("radio", { name: /^Code/ }).check();
  await dialog.getByRole("radio", { name: /^Multi-user/ }).check();
  await dialog.getByRole("radio", { name: /^Chat/ }).check();
  await dialog.getByRole("radio", { name: /^Code/ }).check();
  await expect(dialog.getByRole("radio", { name: /^Single user/ })).toBeChecked();
  await dialog.getByRole("radio", { name: /^Multi-user/ }).check();

  const created = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      /\/api\/workspaces\/[^/]+\/channels$/.test(new URL(response.url()).pathname),
  );
  await dialog.getByRole("button", { name: "Create channel" }).click();
  const createResponse = await created;
  expect(createResponse.ok()).toBe(true);
  const createBody = (await createResponse.json()) as {
    channel: { id: string; template: string; code_mode: string };
  };
  expect(createBody.channel).toMatchObject({ template: "code", code_mode: "multi_user" });

  const workspace = page.getByRole("complementary", { name: "Code workspace" });
  await expect(workspace).toBeVisible();
  await expect(workspace.getByRole("heading", { name: "Shared project room" })).toBeVisible();
  await expect(workspace.getByRole("button", { name: "Multi-user" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  const updated = page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" &&
      response.url().endsWith(`/api/channels/${createBody.channel.id}`),
  );
  await workspace.getByRole("button", { name: "Single user" }).click();
  const updateResponse = await updated;
  expect(updateResponse.ok()).toBe(true);
  const updateBody = (await updateResponse.json()) as {
    channel: { template: string; code_mode: string };
  };
  expect(updateBody.channel).toMatchObject({ template: "code", code_mode: "single_user" });

  await page.reload();
  await waitForAppReady(page);
  await expect(page.getByRole("heading", { name: "Personal agent room" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Single user" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  for (const viewport of [
    { width: 780, height: 700 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
    await expect(page.getByRole("complementary", { name: "Code workspace" })).toBeVisible();
    await expect(page.getByLabel("Message body")).toBeVisible();
  }
});
