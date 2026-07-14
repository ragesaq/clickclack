<script lang="ts">
  import type { Channel } from "../../lib/types";

  type CodeMode = Channel["code_mode"];

  type Props = {
    channel: Channel;
    canManage: boolean;
    agentActive: boolean;
    updating: boolean;
    error: string;
    onMode: (mode: CodeMode) => void;
  };

  let { channel, canManage, agentActive, updating, error, onMode }: Props = $props();

  let multiUser = $derived(channel.code_mode === "multi_user");
</script>

<aside class="code-workspace-rail" aria-label="Code workspace">
  <header class="code-workspace-head">
    <div>
      <span class="code-workspace-kicker">Code workspace</span>
      <h2>{multiUser ? "Shared project room" : "Personal agent room"}</h2>
    </div>
    <span class:active={agentActive} class="agent-state">
      <i aria-hidden="true"></i>{agentActive ? "Agent working" : "Agent idle"}
    </span>
  </header>

  <div class="code-mode-switch" role="group" aria-label="Code workspace mode">
    <button
      type="button"
      class:active={!multiUser}
      aria-pressed={!multiUser}
      disabled={!canManage || updating}
      onclick={() => onMode("single_user")}
    >Single user</button>
    <button
      type="button"
      class:active={multiUser}
      aria-pressed={multiUser}
      disabled={!canManage || updating}
      onclick={() => onMode("multi_user")}
    >Multi-user</button>
  </div>

  <p class="code-mode-copy">
    {#if multiUser}
      People share project status here. Owner-scoped agent activation arrives in the next slice.
    {:else}
      This view follows one person and the agent they are working with.
    {/if}
  </p>
  {#if error}<p class="code-mode-error" role="alert">{error}</p>{/if}
  {#if !canManage}
    <p class="code-mode-note">Only the workspace owner can change this mode.</p>
  {/if}

  <div class="code-workspace-panels">
    <section>
      <header><span>01</span><h3>{multiUser ? "Shared goal" : "Plan & goal"}</h3></header>
      <p>No active goal yet.</p>
      <small>Accepted plans will stay here as progress begins.</small>
    </section>
    <section>
      <header><span>02</span><h3>Pull request</h3></header>
      <p>No pull request linked.</p>
      <small>The primary revision and check state will appear here.</small>
    </section>
    <section>
      <header><span>03</span><h3>{multiUser ? "Agents" : "My agent"}</h3></header>
      <p>{agentActive ? "Work is visible in the conversation." : "Waiting for an explicit mention."}</p>
      <small>{multiUser ? "Other members' agent controls will stay read-only." : "Agent activity remains durable in this room."}</small>
    </section>
    <section>
      <header><span>04</span><h3>Artifacts</h3></header>
      <p>No project artifacts yet.</p>
      <small>Plans, decisions, review findings, and files collect here.</small>
    </section>
  </div>
</aside>
