# Clickglass History Reconciliation

The first integration should mirror OpenClaw history into Clickglass while preserving a later move to Clickglass-native chat.

## Option A: Mirror First

OpenClaw/HyperMem remains source of truth. A bridge mirrors chat-shaped messages into Clickglass for display, realtime cursor replay, search, reactions, and channel navigation.

This is the recommended first step because it does not re-source agent memory. It also lets us test ClickClack's UX and event model against real fleet traffic before moving the memory pipeline.

Required bridge behavior:

- Assign or preserve a stable ClickClack `msg_` ID for every mirrored chat row.
- Store a durable mapping from OpenClaw message identity to ClickClack message ID.
- Mirror create, edit, soft-delete, reaction, and read-marker events.
- Avoid fuzzy content/time dedupe. Identity mapping wins.
- Keep runtime chrome in the sidecar keyed by ClickClack message ID.
- Keep canvas artifacts outside ClickClack and link them from the chat row when needed.

## Option B: Native Later

Clickglass becomes the chat source of truth. Agents post to Clickglass as bot users, and HyperMem ingests from Clickglass events.

This is cleaner long term because it removes the bridge as a source-of-truth sync layer. It is higher risk for v1 because it changes memory ingestion, agent posting, and replay semantics at the same time.

## Compatibility Rule

The Option A bridge must be designed as a reversible seam:

- All mirrored rows keep both OpenClaw identity and ClickClack identity.
- Runtime metadata is transport-agnostic and keyed by ClickClack message ID.
- Agent authors map to ClickClack bot users from day one.
- Flat thread semantics only. Nested replies stay out of scope.

That makes Option B a source-of-truth flip, not a UI rewrite.
