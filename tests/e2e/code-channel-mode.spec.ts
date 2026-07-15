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
    workspace: { id: string; route_id: string };
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
  await expect(workspace.getByRole("heading", { name: `#${channelName}` })).toBeVisible();
  await workspace.getByRole("button", { name: "Channel settings" }).click();
  await expect(workspace.getByText("Multi-user project room", { exact: true })).toBeVisible();
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

  const meResponse = await page.request.get("/api/me");
  expect(meResponse.ok()).toBe(true);
  const { user: currentUser } = (await meResponse.json()) as {
    user: { id: string; display_name: string };
  };
  const botResponse = await page.request.post(`/api/workspaces/${isolatedWorkspace.id}/bots`, {
    data: {
      owner_user_id: currentUser.id,
      display_name: "Chisel",
      handle: "chisel-stock",
      token_name: "code-room-e2e",
      scopes: ["bot:write"],
    },
  });
  expect(botResponse.ok()).toBe(true);
  const { bot } = (await botResponse.json()) as { bot: { id: string } };
  const incompleteRuntimeProfileResponse = await page.request.patch(
    `/api/workspaces/${isolatedWorkspace.id}/bots/${bot.id}/runtime-profile`,
    { data: {} },
  );
  expect(incompleteRuntimeProfileResponse.status()).toBe(400);
  const runtimeProfileResponse = await page.request.patch(
    `/api/workspaces/${isolatedWorkspace.id}/bots/${bot.id}/runtime-profile`,
    {
      data: { harness: "OpenClaw", model: "openai/GPT-5.6-sol", thinking: "high" },
    },
  );
  expect(runtimeProfileResponse.ok()).toBe(true);
  const pullRequestResponse = await page.request.patch(`/api/channels/${createBody.channel.id}`, {
    data: {
      pull_request_url: "https://github.com/PsiClawOps/clickclack-codex-plugin/pull/1",
      pull_request_title: "ClickClack for Codex",
    },
  });
  expect(pullRequestResponse.ok()).toBe(true);

  await page.route(
    `**/api/channels/${createBody.channel.id}/pull-request-status`,
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          pull_request: {
            state: "open",
            ci_state: "passing",
            checks_total: 4,
            review_state: "approved",
            last_reply_author: "caliper",
            last_reply_at: "2026-07-15T01:20:00Z",
            updated_at: "2026-07-15T01:20:00Z",
          },
        }),
      });
    },
  );

  await page.reload();
  await waitForAppReady(page);
  await workspace.getByRole("button", { name: "Channel settings" }).click();
  await expect(workspace.getByText("Personal agent room", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Single user" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  // Compact two-line identity strip: line 1 = name / @handle · kind,
  // line 2 = owner · provider-qualified model · thinking. Assert the exact
  // composed content of each line rather than stray standalone text nodes.
  const identityRow = workspace.locator(".code-agent-row");
  await expect(identityRow).toHaveCount(1);
  await expect(identityRow.locator(".code-agent-line-primary")).toHaveText(
    "Chisel / @chisel-stock · OpenClaw Agent",
  );
  await expect(identityRow.locator(".code-agent-line-meta")).toHaveText(
    `owner ${currentUser.display_name} · model: openai/GPT-5.6-sol · high`,
  );
  const lineWidths = await identityRow.locator(".code-agent-line").evaluateAll((lines) =>
    lines.map((line) => ({ clientWidth: line.clientWidth, scrollWidth: line.scrollWidth })),
  );
  expect(lineWidths.every(({ clientWidth, scrollWidth }) => scrollWidth <= clientWidth)).toBe(true);
  await expect(workspace.getByRole("link", { name: "Open ClickClack for Codex" })).toHaveAttribute(
    "href",
    "https://github.com/PsiClawOps/clickclack-codex-plugin/pull/1",
  );
  await expect(workspace.getByText("Passing · 4 checks", { exact: true })).toBeVisible();
  await expect(workspace.getByText("Approved", { exact: true })).toBeVisible();
  await expect(workspace.getByText(/@caliper/)).toBeVisible();

  await workspace.getByRole("button", { name: "Write freehand" }).click();
  await workspace.getByLabel("Goal").fill("Ship a durable code-room workflow");
  await workspace.getByLabel("Plan").fill("Inspect the state\nPatch the rail\nVerify the result");
  const notesUpdated = page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" &&
      response.url().endsWith(`/api/channels/${createBody.channel.id}/workspace-notes`),
  );
  await workspace.getByRole("button", { name: "Save" }).click();
  expect((await notesUpdated).ok()).toBe(true);
  await expect(
    workspace.getByText("Ship a durable code-room workflow", { exact: true }),
  ).toBeVisible();
  await expect(workspace.getByText(/Patch the rail/)).toBeVisible();

  await workspace.getByRole("button", { name: "Minimize code workspace" }).click();
  await expect(page.locator(".conversation-surface")).toHaveClass(/code-rail-collapsed/);
  await expect(workspace.getByRole("button", { name: "Open code workspace" })).toBeVisible();
  await expect(page.getByLabel("Message body")).toBeVisible();
  await workspace.getByRole("button", { name: "Open code workspace" }).click();
  await expect(workspace.getByRole("button", { name: "Minimize code workspace" })).toBeVisible();

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
