<script lang="ts">
  type Props = {
    channelName: string;
    template: "chat" | "code";
    codeMode: "single_user" | "multi_user";
    status: string;
    onChannelName: (value: string) => void;
    onTemplate: (value: "chat" | "code") => void;
    onCodeMode: (value: "single_user" | "multi_user") => void;
    onClose: () => void;
    onCreate: () => void;
  };

  let {
    channelName,
    template,
    codeMode,
    status,
    onChannelName,
    onTemplate,
    onCodeMode,
    onClose,
    onCreate,
  }: Props = $props();
</script>

<div class="modal-scrim" role="presentation">
  <button class="modal-backdrop" type="button" aria-label="Close channel dialog" onclick={onClose}></button>
  <section class="profile-modal create-modal" aria-label="Create channel">
    <header>
      <div>
        <p>Channels</p>
        <h2>Create channel</h2>
      </div>
      <button type="button" aria-label="Close channel dialog" onclick={onClose}>×</button>
    </header>
    <form
      class="profile-form"
      onsubmit={(event) => {
        event.preventDefault();
        onCreate();
      }}
    >
      <label class="field">
        <span>Channel name</span>
        <input
          value={channelName}
          aria-label="Channel name"
          placeholder="product-launch"
          autocomplete="off"
          oninput={(event) => onChannelName(event.currentTarget.value)}
        />
      </label>
      <fieldset class="channel-choice-group">
        <legend>Channel layout</legend>
        <div class="channel-choice-grid">
          <label class:active={template === "chat"}>
            <input
              type="radio"
              name="channel-template"
              value="chat"
              checked={template === "chat"}
              onchange={() => onTemplate("chat")}
            />
            <span>
              <strong>Chat</strong>
              <small>A focused conversation with the standard message timeline.</small>
            </span>
          </label>
          <label class:active={template === "code"}>
            <input
              type="radio"
              name="channel-template"
              value="code"
              checked={template === "code"}
              onchange={() => onTemplate("code")}
            />
            <span>
              <strong>Code</strong>
              <small>Conversation plus agent status and durable project context.</small>
            </span>
          </label>
        </div>
      </fieldset>
      {#if template === "code"}
        <fieldset class="channel-choice-group code-mode-choice">
          <legend>Code workspace</legend>
          <div class="channel-choice-grid">
            <label class:active={codeMode === "single_user"}>
              <input
                type="radio"
                name="code-mode"
                value="single_user"
                checked={codeMode === "single_user"}
                onchange={() => onCodeMode("single_user")}
              />
              <span>
                <strong>Single user</strong>
                <small>Your agent, its work, and your project status.</small>
              </span>
            </label>
            <label class:active={codeMode === "multi_user"}>
              <input
                type="radio"
                name="code-mode"
                value="multi_user"
                checked={codeMode === "multi_user"}
                onchange={() => onCodeMode("multi_user")}
              />
              <span>
                <strong>Multi-user</strong>
                <small>Shared project status for people and their agents.</small>
              </span>
            </label>
          </div>
        </fieldset>
      {/if}
      {#if status}<p class="profile-status">{status}</p>{/if}
      <div class="profile-actions">
        <button type="button" class="ghost-action" onclick={onClose}>Cancel</button>
        <button type="submit" class="primary-action">Create channel</button>
      </div>
    </form>
  </section>
</div>
