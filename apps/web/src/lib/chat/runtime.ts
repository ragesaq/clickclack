// Clickglass runtime-metadata sidecar.
//
// ClickClack messages have no runtime fields (model / thinking / duration).
// ClawCanvas shows that chrome around every agent turn. Rather than fork
// clickclack's schema, clickglass carries runtime metadata OUT OF BAND and
// joins it to messages by their msg_ ULID at render time.
//
// Transport (prototype): a map keyed by message_id. In production this is fed
// by a parallel private-events stream or a sidecar endpoint (see
// docs/runtime-chrome-sidecar.md). Keeping it client-side and id-keyed means
// the join is identical regardless of which transport delivers it.

import type { Message, MessageRuntime, ThinkingMode } from "../types";

const registry = new Map<string, MessageRuntime>();

/** Merge runtime metadata for a message id (id-keyed, transport-agnostic). */
export function ingestRuntime(messageID: string, runtime: MessageRuntime): void {
  if (!messageID) return;
  const prev = registry.get(messageID);
  registry.set(messageID, prev ? { ...prev, ...runtime } : runtime);
}

/** Bulk ingest, e.g. from a sidecar fetch over a loaded message window. */
export function ingestRuntimeBatch(entries: Record<string, MessageRuntime>): void {
  for (const [id, runtime] of Object.entries(entries)) ingestRuntime(id, runtime);
}

export function runtimeFor(messageID: string): MessageRuntime | undefined {
  return registry.get(messageID);
}

/** Attach runtime (if known) to a message for rendering. Pure, non-mutating. */
export function withRuntime(message: Message): Message {
  const runtime = registry.get(message.id);
  return runtime ? { ...message, runtime } : message;
}

export function clearRuntimeRegistry(): void {
  registry.clear();
}

// ---------- formatting (mirrors ClawCanvas chrome) ----------

/** Short model label: drop the provider prefix for the chip, keep it in title. */
export function modelLabel(model?: string): string {
  if (!model) return "";
  const slash = model.lastIndexOf("/");
  return slash >= 0 ? model.slice(slash + 1) : model;
}

export function providerLabel(runtime: MessageRuntime): string {
  if (runtime.provider) return runtime.provider;
  const model = runtime.model || "";
  const slash = model.indexOf("/");
  return slash >= 0 ? model.slice(0, slash) : "";
}

/** True when the turn ran under a model override (effective != agent default). */
export function isModelOverridden(runtime: MessageRuntime): boolean {
  return Boolean(runtime.agent_model && runtime.model && runtime.agent_model !== runtime.model);
}

const THINKING_LABEL: Record<ThinkingMode, string> = {
  off: "Think: off",
  low: "Think: low",
  medium: "Think: med",
  high: "Think: high",
  xhigh: "Think: x-high",
  adaptive: "Think: adaptive",
};

export function thinkingLabel(mode?: ThinkingMode): string {
  return mode ? THINKING_LABEL[mode] : "";
}

/** ClawCanvas-style elapsed formatting: 820ms, 4.2s, 1m 03s. */
export function formatDuration(ms?: number): string {
  if (ms == null || ms < 0) return "";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

export function formatTokens(runtime: MessageRuntime): string {
  const { tokens_in: tin, tokens_out: tout } = runtime;
  if (tin == null && tout == null) return "";
  const fmt = (n?: number) =>
    n == null ? "?" : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
  return `${fmt(tin)}/${fmt(tout)} tok`;
}

// ---------- dev demo seeding ----------
//
// The dev bootstrap only creates a human user, so there are no instrumented
// agent turns to show chrome on. When localStorage["clickglass:demo-runtime"]
// is "1", synthesize representative runtime for loaded messages so the chrome
// is visible on the running prototype. Strictly a demo affordance; production
// runtime arrives over the real sidecar/events transport.
const DEMO_FLAG = "clickglass:demo-runtime";

const DEMO_SAMPLES: MessageRuntime[] = [
  {
    model: "anthropic/claude-opus-4-8",
    agent_model: "anthropic/claude-opus-4-8",
    thinking: "xhigh",
    duration_ms: 18420,
    tokens_in: 84700,
    tokens_out: 19900,
  },
  {
    model: "openai/gpt-5.4",
    agent_model: "anthropic/claude-opus-4-8",
    thinking: "high",
    duration_ms: 4200,
    tokens_in: 12300,
    tokens_out: 3100,
  },
  {
    model: "anthropic/claude-sonnet-4-6",
    agent_model: "anthropic/claude-sonnet-4-6",
    thinking: "adaptive",
    duration_ms: 820,
  },
];

export function demoRuntimeEnabled(): boolean {
  try {
    if (typeof window === "undefined") return false;
    if (window.localStorage.getItem(DEMO_FLAG) === "1") return true;
    // URL trigger (?demo=1) so headless screenshots / quick links work without
    // pre-seeding localStorage.
    return new URLSearchParams(window.location.search).get("demo") === "1";
  } catch {
    return false;
  }
}

/** Deterministically attach sample runtime to messages (dev demo only). */
export function seedDemoRuntime(messages: Message[]): void {
  if (!demoRuntimeEnabled()) return;
  messages.forEach((message, index) => {
    if (registry.has(message.id)) return;
    ingestRuntime(message.id, DEMO_SAMPLES[index % DEMO_SAMPLES.length]);
  });
}

/** Does this runtime have anything worth rendering? */
export function hasRuntimeChrome(runtime?: MessageRuntime): runtime is MessageRuntime {
  if (!runtime) return false;
  return Boolean(
    runtime.model ||
    runtime.thinking ||
    runtime.duration_ms != null ||
    runtime.tokens_in != null ||
    runtime.tokens_out != null,
  );
}
