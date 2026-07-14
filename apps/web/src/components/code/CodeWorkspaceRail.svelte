<script lang="ts">
  import type { Channel, User } from "../../lib/types";

  type CodeMode = Channel["code_mode"];

  type Props = {
    channel: Channel;
    canManage: boolean;
    agentActive: boolean;
    agents: User[];
    updating: boolean;
    error: string;
    onMode: (mode: CodeMode) => void;
  };

  let { channel, canManage, agentActive, agents, updating, error, onMode }: Props = $props();

  let multiUser = $derived(channel.code_mode === "multi_user");

  function initials(agent: User): string {
    const words = agent.display_name.trim().split(/\s+/).filter(Boolean);
    return (words.length > 1 ? `${words[0][0]}${words[1][0]}` : words[0]?.slice(0, 2) || "?").toUpperCase();
  }

  function pullRequestReference(rawURL: string): string {
    try {
      const url = new URL(rawURL);
      const [owner, repo, , number] = url.pathname.split("/").filter(Boolean);
      return owner && repo && number ? `${owner}/${repo} #${number}` : rawURL;
    } catch {
      return rawURL;
    }
  }
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
      {#if channel.pull_request_url}
        <a
          class="code-pr-link"
          href={channel.pull_request_url}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open ${channel.pull_request_title || "linked pull request"}`}
        >
          <strong>{channel.pull_request_title || pullRequestReference(channel.pull_request_url)}</strong>
          <small>{pullRequestReference(channel.pull_request_url)}</small>
        </a>
      {:else}
        <p>No pull request linked.</p>
        <small>The workspace owner can attach the primary revision through the channel API.</small>
      {/if}
    </section>
    <section>
      <header><span>03</span><h3>{multiUser ? "Agents" : agents.length === 1 ? "My agent" : "My agents"}</h3></header>
      {#if agents.length > 0}
        <div class="code-agent-list">
          {#each agents as agent (agent.id)}
            <div class="code-agent-row">
              <span class="code-agent-avatar" aria-hidden="true">{initials(agent)}</span>
              <span>
                <strong>{agent.display_name}</strong>
                <small>{agent.handle ? `@${agent.handle}` : "Bot participant"}</small>
              </span>
            </div>
          {/each}
        </div>
        <small>{agentActive ? "Agent work is live in the conversation." : "Mention an agent to begin a turn."}</small>
      {:else}
        <p>No agent installed for this room.</p>
        <small>{multiUser ? "Workspace bots will appear here when installed." : "Create an owner-owned bot to attach your agent."}</small>
      {/if}
    </section>
    <section>
      <header><span>04</span><h3>Artifacts</h3></header>
      <p>No project artifacts yet.</p>
      <small>Plans, decisions, review findings, and files collect here.</small>
    </section>
  </div>
</aside>
