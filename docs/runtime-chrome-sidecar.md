# Clickglass Runtime Chrome Sidecar

ClickClack stores chat well, but it does not store OpenClaw runtime metadata. That is the main ClawCanvas parity gap for message chrome.

## Missing In ClickClack

- Effective model and provider.
- Agent default model versus per-turn override.
- Thinking mode.
- Turn duration receipt.
- Token in/out receipt.
- Canvas-native artifacts such as docs, boards, display scenes, metrics, and embeds.

Clickglass should use ClickClack for chat primitives: message IDs, cursor replay, search, reactions, flat threads, soft delete, and channel structure. Clickglass should keep OpenClaw/ClawCanvas stores for canvas artifacts and runtime-only instrumentation.

## Sidecar Shape

Runtime metadata is keyed by ClickClack `msg_` ULID and joined at render time:

```ts
type MessageRuntime = {
  model?: string;
  agent_model?: string;
  provider?: string;
  thinking?: "off" | "low" | "medium" | "high" | "xhigh" | "adaptive";
  duration_ms?: number;
  tokens_in?: number;
  tokens_out?: number;
};
```

The prototype keeps this in a client-side registry in `apps/web/src/lib/chat/runtime.ts` and attaches it to messages before grouping. Production should feed the same registry through either:

- A sidecar endpoint over the loaded message window.
- A parallel private event stream keyed by `message_id`.

Both paths preserve upstream ClickClack's schema and keep a reachable path to making ClickClack the native chat store later.

## Render Target

`RuntimeChrome.svelte` renders:

- Model chip, with override state when `model !== agent_model`.
- Thinking chip.
- Duration receipt.
- Optional token receipt.

Messages without sidecar runtime render unchanged.
