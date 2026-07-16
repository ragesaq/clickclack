# ClickClack Code Room Project

Status summary for the `feat/code-channel-modes` branch on this fork
(`ragesaq/clickclack`, tracking upstream `openclaw/clickclack`).
Written for collaborators evaluating first-class coding-agent integration
(e.g. Claude Code as a room participant).

## What a code room is

ClickClack is a self-hostable, API-first chat app (Go + SQLite backend,
Svelte 5 SPA, OpenAPI-first protocol in `packages/protocol/openapi.yaml`).
A **code room** is a channel mode where one or more coding agents work in
front of the humans in the room: the agent's streaming commentary, tool
calls, and final responses render as a single connected activity chain per
turn, instead of a flat wall of bot messages.

Channel code modes shipped so far: `single-user` (default) and
`multi-user`, normalized server-side (`NormalizeChannelCodeMode`).

## Protocol surface (already on this branch)

The durable message model carries agent activity as first-class kinds:

- `kind`: `message` | `agent_commentary` | `agent_tool`
  (default `message`)
- `turn_id`: agent-turn correlation ID, allowed only on the two agent
  kinds; ordinary messages reject it
- Agent kinds require bot-token auth with the explicit
  `agent_activity:write` scope; supported on channel and DM create
  endpoints
- `nonce` gives retry-safe idempotent creates

This is the seam an external harness plugs into: publish
`agent_commentary` frames while thinking/narrating, `agent_tool` frames
per tool invocation (same `turn_id`), then the final `message` to close
the turn.

## UI rendering (already on this branch)

Branch head `b7acb5e`. Accepted behavior:

- Outlined human/agent message chains matching the ClickGlass design
  language
- Amber commentary/tool caps ("preamble") that stay connected to the
  final response in one chain — no seam break regardless of turn length
- Preamble auto-collapses when the turn completes (click to expand);
  in-progress turns stay expanded
- Compact agent identity row (name / @handle · Agent, owner · model ·
  thinking), avatar spanning both lines
- Agent registry entries carry `harness`, `model`, `thinking`, and bot
  owner (see `AgentProfile` in the OpenAPI spec)

E2E coverage: `tests/e2e/code-channel-mode.spec.ts`,
`tests/e2e/agent-activity-chain.spec.ts`, `tests/e2e/message-window.spec.ts`.

## The open seam: runtime event publishing

The UI renders activity chains; the missing half is harnesses actually
publishing them. Today nothing in stock ClickClack emits
`agent_commentary`/`agent_tool` automatically — each agent runtime must
bridge its own internal events (thinking, tool start/finish, final) to
the message-create endpoint with the right `kind` + `turn_id`.

For a Claude Code integration this means a thin adapter:

1. Register a bot user with `agent_activity:write` scope and an
   `AgentProfile` (`harness: "claude-code"`, model, thinking mode, owner).
2. On each turn: mint a `turn_id`, stream commentary frames as
   `agent_commentary`, emit one `agent_tool` message per tool call, and
   finish with a normal `message` carrying the same `turn_id`.
3. Idempotency via `nonce` for retry safety.

The UI needs no changes to render a harness that follows this contract.

## Candidate areas for joint PRs

Backlog items already scoped as binding product requirements
(see `DESIGN_NOTES_ragesaq.md`):

- **Verbosity parity first**: default code-room rendering must reach
  parity with full streaming commentary + tool-call visibility before
  any verbosity-reduction options are added
- Code-room verbosity controls (opt-in reductions, post-parity)
- Right-rail structure: minimizable "My Agents" rail, room-mode toggle
  moved under Channel Settings
- Operator-editable Plan and Goal (freehand, alongside agent edits)
- Richer Pull Request panel: live status, last reply, pending/merged,
  CI state
- Harness adapters: the event-publishing bridge described above, per
  harness (Claude Code, others)

## Repo pointers

- Protocol: `packages/protocol/openapi.yaml`
- Web UI: `apps/web/src/components/messages/` (chain rendering:
  `MessageGroup.svelte`, `PreambleBlock.svelte`, `MessageList.svelte`)
- Message windowing: `apps/web/src/lib/chat/messageWindow.ts`
- API: `apps/api/`
- Spec/product frame: `SPEC.md`
