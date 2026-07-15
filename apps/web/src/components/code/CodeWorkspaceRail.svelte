<script lang="ts">
  import type {
    BotRuntimeProfile,
    Channel,
    PullRequestStatus,
    User,
  } from "../../lib/types";

  type CodeMode = Channel["code_mode"];

  type Props = {
    channel: Channel;
    canManage: boolean;
    agentActive: boolean;
    collapsed: boolean;
    agents: User[];
    people: User[];
    updating: boolean;
    error: string;
    notesUpdating: boolean;
    notesError: string;
    onMode: (mode: CodeMode) => void;
    onCollapsed: (collapsed: boolean) => void;
    onNotes: (planBody: string, goalBody: string) => Promise<boolean>;
  };

  let {
    channel,
    canManage,
    agentActive,
    collapsed,
    agents,
    people,
    updating,
    error,
    notesUpdating,
    notesError,
    onMode,
    onCollapsed,
    onNotes,
  }: Props = $props();

  let settingsOpen = $state(false);
  let editingNotes = $state(false);
  let draftPlan = $state("");
  let draftGoal = $state("");
  let activeChannelID = $state("");
  let pullRequestStatus = $state<PullRequestStatus | null>(null);
  let pullRequestLoading = $state(false);
  let pullRequestError = $state("");
  let runtimeProfiles = $state<Record<string, BotRuntimeProfile>>({});

  let multiUser = $derived(channel.code_mode === "multi_user");

  $effect(() => {
    if (channel.id === activeChannelID) return;
    activeChannelID = channel.id;
    draftPlan = channel.plan_body;
    draftGoal = channel.goal_body;
    editingNotes = false;
    settingsOpen = false;
    void loadPullRequestStatus();
    void loadRuntimeProfiles();
  });

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

  function ownerName(agent: User): string {
    if (!agent.owner_user_id) return "Workspace-owned";
    const owner = people.find((person) => person.id === agent.owner_user_id);
    return owner?.display_name || owner?.handle || "Owner unavailable";
  }

  function formatTimestamp(value: string): string {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "unknown time";
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(parsed);
  }

  function ciLabel(status: PullRequestStatus): string {
    switch (status.ci_state) {
      case "passing": return status.checks_total > 0 ? `Passing · ${status.checks_total} checks` : "Passing";
      case "failing": return status.checks_total > 0 ? `Failing · ${status.checks_total} checks` : "Failing";
      case "pending": return status.checks_total > 0 ? `Running · ${status.checks_total} checks` : "Running";
      case "not_reported": return "No CI reported";
      default: return "CI unavailable";
    }
  }

  function reviewLabel(status: PullRequestStatus): string {
    switch (status.review_state) {
      case "approved": return "Approved";
      case "changes_requested": return "Changes requested";
      default: return "Review pending";
    }
  }

  async function loadPullRequestStatus(): Promise<void> {
    pullRequestStatus = null;
    pullRequestError = "";
    if (!channel.pull_request_url) return;
    const channelID = channel.id;
    pullRequestLoading = true;
    try {
      const response = await fetch(`/api/channels/${channelID}/pull-request-status`);
      if (!response.ok) throw new Error(`request failed: ${response.status}`);
      const body = (await response.json()) as { pull_request: PullRequestStatus };
      if (channel.id === channelID) pullRequestStatus = body.pull_request;
    } catch {
      if (channel.id === channelID) {
        pullRequestError = "GitHub could not read this PR. Private repositories need a configured read token.";
      }
    } finally {
      if (channel.id === channelID) pullRequestLoading = false;
    }
  }

  async function loadRuntimeProfiles(): Promise<void> {
    const workspaceID = channel.workspace_id;
    try {
      const response = await fetch(`/api/workspaces/${workspaceID}/agent-profiles`);
      if (!response.ok) return;
      const body = (await response.json()) as { profiles: BotRuntimeProfile[] };
      if (channel.workspace_id !== workspaceID) return;
      runtimeProfiles = Object.fromEntries(body.profiles.map((profile) => [profile.bot_user_id, profile]));
    } catch {
      runtimeProfiles = {};
    }
  }

  function beginNotesEdit(): void {
    draftPlan = channel.plan_body;
    draftGoal = channel.goal_body;
    editingNotes = true;
  }

  async function saveNotes(): Promise<void> {
    if (await onNotes(draftPlan, draftGoal)) editingNotes = false;
  }
</script>

<aside class:collapsed class="code-workspace-rail" aria-label="Code workspace">
  {#if collapsed}
    <button
      type="button"
      class="code-rail-restore"
      aria-label="Open code workspace"
      aria-expanded="false"
      onclick={() => onCollapsed(false)}
    >
      <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m8 5 5 5-5 5M3 3h2v14H3" /></svg>
      <span>Workspace</span>
      <i class:active={agentActive} aria-hidden="true"></i>
    </button>
  {:else}
    <header class="code-workspace-head">
      <div>
        <span class="code-workspace-kicker">Code workspace</span>
        <h2>#{channel.name}</h2>
      </div>
      <div class="code-workspace-actions">
        <span class:active={agentActive} class="agent-state">
          <i aria-hidden="true"></i>{agentActive ? "Working" : "Idle"}
        </span>
        <button
          type="button"
          class:active={settingsOpen}
          class="code-icon-button"
          aria-label="Channel settings"
          aria-expanded={settingsOpen}
          onclick={() => (settingsOpen = !settingsOpen)}
        >
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 5h8M15 5h2M3 10h2M9 10h8M3 15h6M13 15h4M11 3v4M7 8v4M11 13v4" /></svg>
        </button>
        <button
          type="button"
          class="code-icon-button"
          aria-label="Minimize code workspace"
          aria-expanded="true"
          onclick={() => onCollapsed(true)}
        >
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m12 5-5 5 5 5M17 3h-2v14h2" /></svg>
        </button>
      </div>
    </header>

    {#if settingsOpen}
      <section class="code-settings-panel" aria-label="Channel settings panel">
        <header>
          <div>
            <span>Channel settings</span>
            <strong>{multiUser ? "Multi-user project room" : "Personal agent room"}</strong>
          </div>
          <button type="button" class="code-text-button" onclick={() => (settingsOpen = false)}>Done</button>
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
        <p>{multiUser ? "Everyone in the room shares project state." : "The room follows one operator and their owner-scoped agents."}</p>
        {#if error}<p class="code-mode-error" role="alert">{error}</p>{/if}
        {#if !canManage}<p class="code-mode-note">Only the workspace owner can change this setting.</p>{/if}
      </section>
    {/if}

    <div class="code-workspace-panels">
      <section class="code-plan-panel">
        <header>
          <span>01</span>
          <h3>Plan & goal</h3>
          {#if canManage && !editingNotes}
            <button type="button" class="code-text-button" onclick={beginNotesEdit}>Edit</button>
          {/if}
        </header>
        {#if editingNotes}
          <label>
            <span>Goal</span>
            <textarea bind:value={draftGoal} rows="3" maxlength="20000" placeholder="Define the outcome in your own words"></textarea>
          </label>
          <label>
            <span>Plan</span>
            <textarea bind:value={draftPlan} rows="7" maxlength="20000" placeholder="Write or paste the working plan"></textarea>
          </label>
          {#if notesError}<p class="code-mode-error" role="alert">{notesError}</p>{/if}
          <div class="code-note-actions">
            <button type="button" class="code-secondary-button" disabled={notesUpdating} onclick={() => (editingNotes = false)}>Cancel</button>
            <button type="button" class="code-primary-button" disabled={notesUpdating} onclick={() => void saveNotes()}>{notesUpdating ? "Saving…" : "Save"}</button>
          </div>
        {:else if channel.goal_body || channel.plan_body}
          {#if channel.goal_body}
            <div class="code-note-block">
              <strong>Goal</strong>
              <p>{channel.goal_body}</p>
            </div>
          {/if}
          {#if channel.plan_body}
            <div class="code-note-block">
              <strong>Plan</strong>
              <p>{channel.plan_body}</p>
            </div>
          {/if}
          <small>Editable here by the operator or through the bot API by an owner-scoped agent.</small>
        {:else}
          <p>No plan or goal yet.</p>
          {#if canManage}
            <button type="button" class="code-inline-action" onclick={beginNotesEdit}>Write freehand</button>
          {:else}
            <small>The workspace owner or their agent can add one.</small>
          {/if}
        {/if}
      </section>

      <section>
        <header>
          <span>02</span>
          <h3>Pull request</h3>
          {#if channel.pull_request_url}
            <button type="button" class="code-text-button" disabled={pullRequestLoading} onclick={() => void loadPullRequestStatus()}>Refresh</button>
          {/if}
        </header>
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
          {#if pullRequestLoading}
            <div class="code-status-skeleton" aria-label="Loading pull request status"><i></i><i></i><i></i></div>
          {:else if pullRequestStatus}
            <div class="code-pr-status">
              <span class={`state-${pullRequestStatus.state}`}>{pullRequestStatus.state}</span>
              <dl>
                <div><dt>CI</dt><dd class={`state-${pullRequestStatus.ci_state}`}>{ciLabel(pullRequestStatus)}</dd></div>
                <div><dt>Review</dt><dd>{reviewLabel(pullRequestStatus)}</dd></div>
                <div><dt>Last reply</dt><dd>@{pullRequestStatus.last_reply_author} · {formatTimestamp(pullRequestStatus.last_reply_at)}</dd></div>
              </dl>
            </div>
          {:else if pullRequestError}
            <p class="code-mode-error" role="status">{pullRequestError}</p>
          {/if}
        {:else}
          <p>No pull request linked.</p>
          <small>The workspace owner can attach the primary revision through channel settings or the API.</small>
        {/if}
      </section>

      <section>
        <header><span>03</span><h3>{multiUser ? "Agents" : agents.length === 1 ? "My agent" : "My agents"}</h3></header>
        {#if agents.length > 0}
          <div class="code-agent-list">
            {#each agents as agent (agent.id)}
              {@const profile = runtimeProfiles[agent.id]}
              <article class="code-agent-row">
                <span class="code-agent-avatar" aria-hidden="true">{initials(agent)}</span>
                <div class="code-agent-identity">
                  <span class="code-agent-line code-agent-line-primary">
                    <strong>{agent.display_name}</strong>
                    {#if agent.handle}<span class="code-agent-handle">/ @{agent.handle}</span>{/if}
                    <span class="code-agent-kind">· OpenClaw Agent</span>
                  </span>
                  <span class="code-agent-line code-agent-line-meta">
                    owner {ownerName(agent)} · model: {profile?.model || "Not reported"} · {profile?.thinking || "Not reported"}
                  </span>
                </div>
              </article>
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
  {/if}
</aside>
