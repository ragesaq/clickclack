// Live capture driver for clickclack agent.progress render proof.
// Connects to a running headless Chromium over CDP, authenticates against a
// dev-bootstrap clickclack server via same-origin magic-link, selects a
// channel, then posts a realistic agent.progress turn lifecycle through the
// REAL producer endpoint (bot token) while screenshotting each step.
//
// Env:
//   CDP_URL    e.g. http://127.0.0.1:9223
//   BASE_URL   e.g. http://127.0.0.1:8771
//   WS_ID, CH_ID, BOT_TOKEN
//   OUT_DIR    frame output dir
//   LABEL      "after" | "before" (overlay tag only)
import pw from "/home/lumadmin/.openclaw/workspace/openclaw-dashboard/node_modules/playwright/index.js";
const { chromium } = pw;
import { mkdirSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const CDP_URL = process.env.CDP_URL;
const BASE = process.env.BASE_URL;
const POST_BASE = process.env.POST_BASE || BASE;
const WS = process.env.WS_ID;
const CH = process.env.CH_ID;
const BOT = process.env.BOT_TOKEN;
const OUT = process.env.OUT_DIR;
const LABEL = process.env.LABEL || "after";
mkdirSync(OUT, { recursive: true });

let frame = 0;
async function shot(page, tag) {
  const n = String(++frame).padStart(4, "0");
  await page.screenshot({ path: `${OUT}/frame_${n}_${tag}.png` });
  process.stdout.write(`shot ${n} ${tag}\n`);
}

async function post(line, op) {
  const body = {
    workspace_id: WS,
    channel_id: CH,
    type: "agent.progress",
    payload: { turn_id: "turn_live_demo", op, line },
  };
  const r = await fetch(`${POST_BASE}/api/realtime/ephemeral`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${BOT}` },
    body: JSON.stringify(body),
  });
  if (r.status !== 202) throw new Error(`post ${op} ${line.id} -> ${r.status} ${await r.text()}`);
}

const browser = await chromium.connectOverCDP(CDP_URL);
const ctx = browser.contexts()[0] || (await browser.newContext());
const page = ctx.pages()[0] || (await ctx.newPage());
await page.setViewportSize({ width: 1340, height: 1000 });

// 1) Load origin, then authenticate via same-origin fetch (sets cc_session).
await page.goto(BASE, { waitUntil: "domcontentloaded" });
const authed = await page.evaluate(async () => {
  const req = await fetch("/api/auth/magic/request", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "local@clickclack.chat", display_name: "Local Captain" }),
  });
  const tok = (await req.json()).token;
  const con = await fetch("/api/auth/magic/consume", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: tok }),
  });
  return con.status;
});
process.stdout.write(`auth consume status=${authed}\n`);

// 2) Reload into authenticated SPA and open the channel.
await page.goto(BASE, { waitUntil: "networkidle" });
await sleep(1500);
// Click the channel by visible name.
try {
  await page.getByText("general", { exact: false }).first().click({ timeout: 8000 });
} catch (e) {
  process.stdout.write(`channel click fallback: ${e.message}\n`);
}
await sleep(1500);
await shot(page, "idle");

// 3) Drive a realistic turn. Lines build progressively, then finalize (dim).
const lines = [
  { id: "l1", kind: "thinking", text: "Reading the channel request" },
  { id: "l2", kind: "tool", tool_name: "read", text: "ChatApp.svelte", status: "running" },
  { id: "l3", kind: "tool", tool_name: "grep", text: "agent.progress handler", status: "running" },
  { id: "l4", kind: "commentary", text: "Found the render path" },
  { id: "l5", kind: "tool", tool_name: "edit", text: "AgentProgress.svelte", status: "running" },
  { id: "l6", kind: "command_output", text: "go test ./internal/httpapi -> PASS" },
  { id: "l7", kind: "plan", text: "Open PR #24 (consumer half)" },
];

await post(lines[0], "start");
await sleep(700); await shot(page, "live1");
for (let i = 1; i < lines.length; i++) {
  await post(lines[i], "update");
  await sleep(650);
  await shot(page, `live${i + 1}`);
}
// hold the fully-built live state for a beat
await sleep(600); await shot(page, "live_hold");

// 4) Finalize: dim each line (op=finalize).
for (const ln of lines) {
  await post({ ...ln, status: "done" }, "finalize");
}
await sleep(700); await shot(page, "finalized");
await sleep(900); await shot(page, "finalized_hold");

await browser.close();
process.stdout.write("DONE\n");
