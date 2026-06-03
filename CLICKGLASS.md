# Clickglass

Clickglass is PsiClawOps's fork of [openclaw/clickclack](https://github.com/openclaw/clickclack),
reshaped into the ClawCanvas product surface.

## Why this fork exists

ClickClack is a properly-built messaging backend: ULID message IDs, durable
event log with cursor replay, FTS5 search, first-class bots/agents, flat
threads, reactions, uploads, DMs. ClawCanvas has been hand-rolling those exact
primitives on top of HyperMem SQLite (a *memory* store, not a *messaging*
store), which is the root of our long-running duplicate-message,
render-read-dedupe, delivery-status, and reconnect bugs.

Clickglass adopts clickclack's substrate and re-skins the SPA to the modern
ClawCanvas look: agent rail, channel structure, and the edge chrome
(model / thinking-mode / duration) that ClawCanvas users expect.

## Lineage

- `upstream` → `https://github.com/openclaw/clickclack.git` (pull infra/plumbing)
- `origin`   → `git@github-psiclawops:PsiClawOps/clickglass.git` (our work)

Forked at upstream `7673eea` (2026-05-28).

## What we keep vs. change

| Layer | Disposition |
|---|---|
| Go API + SQLite store + realtime hub | **keep** — run unforked where possible |
| ULID IDs, event cursor, FTS5, bots | **keep** — this is the whole point |
| Svelte SPA shell (GuildRail/Sidebar/ChannelList) | **reskin** to ClawCanvas |
| Message-row chrome (model/thinking/duration) | **add** — no native field; needs side-channel |
| HyperMem ↔ clickglass history reconciliation | **bridge** — see docs |

Do not fork the Go binary to mount our UI inside it; that traps us off
upstream. Talk to the documented API/SDK and re-skin the SPA only.
