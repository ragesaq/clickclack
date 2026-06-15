import pw from '/home/lumadmin/.openclaw/workspace/dev/openclaw-upstream/node_modules/playwright-core/index.js';
const { chromium } = pw;
import fs from 'node:fs';

const E = process.env;
const PORT = E.PORT || '8771';
const B = `http://127.0.0.1:${PORT}`;          // loopback for bot posts
const APP = `http://app.localhost:${PORT}`;     // SPA origin
const WSROUTE = E.WSROUTE, CHROUTE = E.CHROUTE, WSP = E.WSP, CH = E.CH, BOT = E.BOT;
const OUTDIR = E.OUTDIR || '/tmp/ccdemo-after-cap';
const LABEL = E.LABEL || 'AFTER';
fs.rmSync(OUTDIR, { recursive: true, force: true });
fs.mkdirSync(OUTDIR, { recursive: true });

let frameN = 0;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function botPost(path, body) {
  const res = await fetch(B + path, {
    method: 'POST',
    headers: { 'authorization': 'Bearer ' + BOT, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.status;
}
function progress(turnId, op, line) {
  return botPost('/api/realtime/ephemeral', {
    type: 'agent.progress', workspace_id: WSP, channel_id: CH,
    payload: { turn_id: turnId, op, ...(line ? { line } : {}) },
  });
}

const SST = E.SST;
const browser = await chromium.connectOverCDP('http://127.0.0.1:18900');
const ctx = browser.contexts()[0] || await browser.newContext();
// Inject the session cookie directly (robust vs in-page magic login origin checks)
await ctx.addCookies([
  { name: 'cc_session', value: SST, domain: 'app.localhost', path: '/', httpOnly: true, secure: false, sameSite: 'Lax', port: undefined },
]);
const page = await ctx.newPage();
await page.setViewportSize({ width: 1340, height: 1000 });

async function shot(tag, n = 1) {
  for (let i = 0; i < n; i++) {
    const p = `${OUTDIR}/frame_${String(frameN).padStart(4, '0')}.png`;
    await page.screenshot({ path: p });
    frameN++;
    if (i < n - 1) await sleep(120);
  }
  console.log(`shot ${tag} -> total ${frameN}`);
}

// 1. session cookie already injected; go straight to the channel route
// 2. navigate to the channel route
await page.goto(`${APP}/app/${WSROUTE}/${CHROUTE}`, { waitUntil: 'networkidle' });
await sleep(1500);

// 3. Post the human's question IN-PAGE as Local Captain (real same-origin send)
const qBody = '@forge the auth integration test is flaking on CI — TestSessionCookiesDefaultSecure. can you take a look and push a fix?';
const qStatus = await page.evaluate(async ({ ch, body }) => {
  const r = await fetch(`/api/channels/${ch}/messages`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'X-ClickClack-CSRF': '1' }, body: JSON.stringify({ body }),
  });
  return r.status;
}, { ch: CH, body: qBody });
console.log('question post status', qStatus);
try {
  await page.waitForFunction(() => document.body.innerText.includes('flaking on CI'), { timeout: 10000 });
  console.log('question visible');
} catch (e) {
  console.log('question NOT visible:', e.message);
  const txt = await page.evaluate(() => document.body.innerText.slice(0, 400));
  console.log('BODY:', JSON.stringify(txt));
}
await sleep(900);

// 4. IDLE state (no progress strip) — hold a few frames
await shot('idle', 6);

// 5. Forge works: stream agent.progress lines
const turn = 'turn_' + Date.now();
const lines = [
  { id: 'l1', kind: 'thinking', text: 'Reproducing the flake locally before touching anything' },
  { id: 'l2', kind: 'tool', tool_name: 'read', text: 'apps/api/internal/httpapi/auth_test.go' },
  { id: 'l3', kind: 'tool', tool_name: 'grep', text: 'SameSite in auth.go session cookie path' },
  { id: 'l4', kind: 'thinking', text: 'Default cookie is Lax; CI runs cross-site so the test loses it' },
  { id: 'l5', kind: 'patch', text: 'auth.go: set SameSite=None + Secure under non-local origin' },
  { id: 'l6', kind: 'command_output', text: 'go test ./internal/httpapi -run SessionCookies  ->  ok  1.84s' },
  { id: 'l7', kind: 'plan', text: 'Fix verified green; pushing branch fix/session-cookie-samesite' },
];
for (const ln of lines) {
  const st = await progress(turn, 'append', ln);
  await sleep(650);
  await shot('line-' + ln.id, 2);
}

// 6. finalize the lines (dim them) just before the answer lands
for (const ln of lines) { await progress(turn, 'finalize', ln); }
await sleep(500);
await shot('finalized', 3);

// 7. Forge posts its REAL answer message into the channel
const answer = "Fixed. Root cause: `setSessionCookie` defaulted to `SameSite=Lax`, so the cross-site CI runner dropped the cookie on the redirect and the assertion saw an anonymous session. Patch sets `SameSite=None; Secure` whenever the request origin isn't local dev. `go test ./internal/httpapi -run SessionCookies` is green. Pushed `fix/session-cookie-samesite` — PR up for review.";
const msgStatus = await botPost(`/api/channels/${CH}/messages`, { body: answer });
console.log('answer message status', msgStatus);
await page.waitForFunction(() => document.body.innerText.includes('Root cause'), { timeout: 8000 }).then(() => console.log('answer visible')).catch(e => console.log('answer NOT visible', e.message));
await sleep(700);
await shot('answer-landed', 5);

// 8. clear the progress strip (turn complete)
await progress(turn, 'clear');
await sleep(900);
await shot('cleared', 6);

console.log('DONE frames=', frameN);
await page.close();
await browser.close();
