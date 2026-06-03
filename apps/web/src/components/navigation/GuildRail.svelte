<script lang="ts">
  import { workspaceInitial } from "../../lib/chat/people";
  import type { Workspace } from "../../lib/types";

  type Props = {
    workspaces: Workspace[];
    selectedWorkspaceID: string;
    workspaceName: string;
    showWorkspaceCreate: boolean;
    hrefForWorkspace: (workspaceID: string) => string;
    onSelectWorkspace: (workspaceID: string) => void;
    onToggleWorkspaceCreate: () => void;
    onWorkspaceName: (value: string) => void;
    onCreateWorkspace: () => void;
  };

  let {
    workspaces,
    selectedWorkspaceID,
    workspaceName,
    showWorkspaceCreate,
    hrefForWorkspace,
    onSelectWorkspace,
    onToggleWorkspaceCreate,
    onWorkspaceName,
    onCreateWorkspace,
  }: Props = $props();

  function shouldHandleClientNavigation(event: MouseEvent): boolean {
    return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
  }
</script>

<nav id="workspace-navigation" class="guild-rail" aria-label="Agents">
  <a class="guild home" title="ClawCanvas home" href="/">
    <span>IC</span>
  </a>
  <div class="guild-divider" aria-hidden="true"></div>
  <div class="guild-list">
    {#each workspaces as workspace (workspace.id)}
      <div class="guild-wrap" class:active={workspace.id === selectedWorkspaceID}>
        <a
          class="guild"
          title={workspace.name}
          href={hrefForWorkspace(workspace.id)}
          onclick={(event) => {
            if (!shouldHandleClientNavigation(event)) return;
            event.preventDefault();
            onSelectWorkspace(workspace.id);
          }}
        >
          <span>{workspaceInitial(workspace.name)}</span>
        </a>
      </div>
    {/each}
    <button
      class="guild add"
      title="Add agent"
      aria-label="Add agent"
      onclick={onToggleWorkspaceCreate}
    >+</button>
  </div>
  {#if showWorkspaceCreate}
    <form
      class="guild-create"
      onsubmit={(event) => {
        event.preventDefault();
        onCreateWorkspace();
      }}
    >
      <input
        value={workspaceName}
        placeholder="Agent name"
        aria-label="Agent name"
        oninput={(event) => onWorkspaceName(event.currentTarget.value)}
      />
    </form>
  {/if}
</nav>
