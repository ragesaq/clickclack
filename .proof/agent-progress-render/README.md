# agent.progress render — real running-app before/after proof

`agent-progress-before-after.gif` is a side-by-side capture of the **real
clickclack web client** (headless Chromium, dev-bootstrap server, SQLite),
driven by **real `agent.progress` frames over the websocket** via the actual
producer endpoint `POST /api/realtime/ephemeral` (bot token holding
`agent_progress:write`).

## Controlled experiment

Both panels run against the **same** data dir, **same** workspace/channel,
**same** bot token, and receive the **identical** posted turn lifecycle. The
only variable is the embedded web bundle:

| Panel | Binary | Web bundle | Result |
|-------|--------|-----------|--------|
| BEFORE | stock `main` (`5b07eee`) | no `AgentProgress.svelte` consumer | frames arrive on the bus, client ignores them — channel stays empty |
| AFTER  | this PR (`pr/agent-progress-render`) | `AgentProgress.svelte` + `ChatApp` handler | frames render as live amber activity lines, then dim on finalize |

## Turn lifecycle posted (identical to both)

1. `thinking` — Reading the channel request
2. `tool` read — ChatApp.svelte
3. `tool` grep — agent.progress handler
4. `commentary` — Found the render path
5. `tool` edit — AgentProgress.svelte
6. `command_output` — go test ./internal/httpapi -> PASS
7. `plan` — Open PR #24 (consumer half)
8. `finalize` — all lines dim (TTL sweep at 45s)

## Reproduce

`capture/driver.mjs` connects to a Chromium over CDP, authenticates against the
dev server via same-origin magic-link, selects the channel, then posts the
lifecycle above through the real producer endpoint while screenshotting each
step. Frames are stitched with ffmpeg. The producer authorization matrix
(bot-only, scoped, single-target) is covered by the Go tests in PR #23.
