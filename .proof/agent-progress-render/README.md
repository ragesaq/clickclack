# Proof — agent.progress render (#24), real running-app before/after

`agent-progress-before-after-real.gif` is a side-by-side capture of the **real
ClickClack web client** (headless Chromium → dev-bootstrap server → SQLite),
driven by **real `agent.progress` frames and a real posted message** over the
websocket. Nothing is mocked or hand-composed; both panels are live screenshots
of the running SvelteKit app.

## The conversation captured (real messages, not a strip in isolation)

1. **Local Captain** (human session) posts a real channel message:
   `@forge the auth integration test is flaking on CI — TestSessionCookiesDefaultSecure...`
2. **Forge** (bot) works the turn: `agent.progress` frames stream over the WS
   (`thinking` → `read` → `grep` → `thinking` → `patch` → `command_output` → `plan`).
3. **Forge** posts its **real answer message** into the channel (markdown code
   spans render). The message lands in the message list — this is the point of
   the feature: live work, then the actual reply.
4. Turn completes → `op:"clear"` → the ephemeral strip disappears, the two real
   messages remain.

## Controlled experiment — only the web bundle differs

| Panel  | Binary                              | Server has producer? | Web renders strip? |
|--------|-------------------------------------|----------------------|--------------------|
| BEFORE | stock web bundle                    | **yes** (frames 202) | **no** (no consumer) |
| AFTER  | this PR's web bundle                | yes (frames 202)     | **yes**            |

Both servers **accept and broadcast the identical `agent.progress` frames**
(verified HTTP 202) and receive the identical posted messages. The only variable
is the embedded web bundle. On BEFORE the frames hit the bus and the stock client
ignores them — the channel shows only the messages. On AFTER the client renders
the live activity strip between the message list and the composer, then clears it.

## Reproduce

```bash
# AFTER server (producer + this PR's web), port 8771
bash capture/setup-after.sh /path/to/clickclack-after-binary
# BEFORE server (producer + stock web), port 8772
bash capture/setup-before.sh
# drive the lifecycle + screenshot (per env), then composite:
node capture/driver.mjs           # writes frames per OUTDIR
python3 capture/build-gif.py      # composites labeled pairs -> GIF
```

The driver injects the dev session cookie, navigates to `/app/{ws}/{ch}`, posts the
human question in-page (same-origin + `X-ClickClack-CSRF: 1`), streams the bot's
`agent.progress` frames (`workspace_id` + single concrete `channel_id`, bot-token
scope `agent_progress:write`), posts the bot's real answer, then clears the turn —
screenshotting each state on both binaries.
