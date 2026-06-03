<script lang="ts">
  // ClawCanvas-parity runtime chrome for an agent message: model chip
  // (with override state), thinking-mode chip, duration receipt, and optional
  // token receipt. Renders nothing when no runtime metadata is attached, so
  // human messages and un-instrumented turns look untouched.
  import type { MessageRuntime } from "../../lib/types";
  import {
    formatDuration,
    formatTokens,
    hasRuntimeChrome,
    isModelOverridden,
    modelLabel,
    providerLabel,
    thinkingLabel,
  } from "../../lib/chat/runtime";

  type Props = { runtime?: MessageRuntime };
  let { runtime }: Props = $props();

  let show = $derived(hasRuntimeChrome(runtime));
</script>

{#if show && runtime}
  <div class="runtime-chrome" aria-label="Agent runtime">
    {#if runtime.model}
      <span
        class="rc-chip rc-model"
        class:overridden={isModelOverridden(runtime)}
        title={`${runtime.model}${providerLabel(runtime) ? ` | ${providerLabel(runtime)}` : ""}${
          isModelOverridden(runtime) ? ` (override of ${runtime.agent_model})` : ""
        }`}
      >
        <span class="rc-dot" aria-hidden="true"></span>
        {modelLabel(runtime.model)}
        {#if isModelOverridden(runtime)}<span class="rc-star" aria-hidden="true">*</span>{/if}
      </span>
    {/if}

    {#if runtime.thinking}
      <span class="rc-chip rc-think" data-mode={runtime.thinking}>
        {thinkingLabel(runtime.thinking)}
      </span>
    {/if}

    {#if runtime.duration_ms != null}
      <span class="rc-receipt" title="Turn duration">{formatDuration(runtime.duration_ms)}</span>
    {/if}

    {#if formatTokens(runtime)}
      <span class="rc-receipt rc-tokens" title="Tokens in/out">{formatTokens(runtime)}</span>
    {/if}
  </div>
{/if}

<style>
  .runtime-chrome {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin-top: 4px;
    user-select: none;
  }

  .rc-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 18px;
    padding: 0 7px;
    border-radius: 999px;
    font-size: 10.5px;
    font-weight: 600;
    letter-spacing: 0.01em;
    line-height: 1;
    border: 1px solid var(--line);
    background: var(--panel);
    color: var(--muted);
    white-space: nowrap;
  }

  .rc-model {
    color: var(--text);
    border-color: color-mix(in srgb, var(--accent) 32%, transparent);
    background: var(--accent-soft);
    font-family:
      "Geist Mono Variable",
      ui-monospace,
      SFMono-Regular,
      monospace;
  }

  .rc-model .rc-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--accent);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 22%, transparent);
  }

  .rc-model.overridden {
    border-color: color-mix(in srgb, var(--warn) 50%, transparent);
    background: color-mix(in srgb, var(--warn) 14%, transparent);
  }

  .rc-model.overridden .rc-dot {
    background: var(--warn);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--warn) 22%, transparent);
  }

  .rc-star {
    color: var(--warn);
    font-size: 9px;
  }

  .rc-think {
    text-transform: none;
  }

  .rc-think[data-mode="off"] {
    opacity: 0.6;
  }

  .rc-think[data-mode="high"],
  .rc-think[data-mode="xhigh"] {
    color: var(--text);
    border-color: color-mix(in srgb, var(--accent-2) 40%, transparent);
    background: color-mix(in srgb, var(--accent-2) 14%, transparent);
  }

  .rc-receipt {
    font-size: 10.5px;
    font-weight: 500;
    color: var(--muted-2);
    font-family:
      "Geist Mono Variable",
      ui-monospace,
      SFMono-Regular,
      monospace;
  }

  .rc-tokens {
    opacity: 0.85;
  }
</style>
