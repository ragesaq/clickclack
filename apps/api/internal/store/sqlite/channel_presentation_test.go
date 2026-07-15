package sqlite

import (
	"context"
	"errors"
	"testing"

	"github.com/openclaw/clickclack/apps/api/internal/store"
)

func TestChannelPresentationPersistsAndOwnerCanChangeMode(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	st := newTestStore(t)
	owner, err := st.EnsureBootstrap(ctx, "Owner", "channel-presentation-owner@example.com")
	if err != nil {
		t.Fatal(err)
	}
	workspaces, err := st.ListWorkspaces(ctx, owner.ID)
	if err != nil {
		t.Fatal(err)
	}
	workspace := workspaces[0]
	channels, err := st.ListChannels(ctx, workspace.ID, owner.ID)
	if err != nil {
		t.Fatal(err)
	}
	if channels[0].Template != store.ChannelTemplateChat || channels[0].CodeMode != store.ChannelCodeModeSingleUser {
		t.Fatalf("unexpected legacy defaults: %#v", channels[0])
	}

	created, _, err := st.CreateChannel(ctx, store.CreateChannelInput{
		WorkspaceID: workspace.ID,
		UserID:      owner.ID,
		Name:        "code-room",
		Template:    store.ChannelTemplateCode,
		CodeMode:    store.ChannelCodeModeMultiUser,
	})
	if err != nil {
		t.Fatal(err)
	}
	if created.Template != store.ChannelTemplateCode || created.CodeMode != store.ChannelCodeModeMultiUser {
		t.Fatalf("unexpected created code channel: %#v", created)
	}

	moderator, err := st.CreateUser(ctx, store.CreateUserInput{DisplayName: "Moderator", Email: "channel-presentation-moderator@example.com"})
	if err != nil {
		t.Fatal(err)
	}
	if err := st.AddWorkspaceMember(ctx, workspace.ID, moderator.ID, store.WorkspaceRoleModerator); err != nil {
		t.Fatal(err)
	}
	if _, _, err := st.UpdateChannel(ctx, store.UpdateChannelInput{
		ChannelID: created.ID,
		UserID:    moderator.ID,
		CodeMode:  store.ChannelCodeModeSingleUser,
	}); err == nil {
		t.Fatal("expected moderator channel mutation to remain forbidden")
	}
	updated, event, err := st.UpdateChannel(ctx, store.UpdateChannelInput{
		ChannelID: created.ID,
		UserID:    owner.ID,
		CodeMode:  store.ChannelCodeModeSingleUser,
	})
	if err != nil {
		t.Fatal(err)
	}
	if updated.CodeMode != store.ChannelCodeModeSingleUser || updated.Template != store.ChannelTemplateCode || event.Type != "channel.updated" {
		t.Fatalf("unexpected updated channel: %#v %#v", updated, event)
	}
	pullRequestURL := "https://github.com/PsiClawOps/clickclack-codex-plugin/pull/1"
	pullRequestTitle := "ClickClack for Codex"
	updated, _, err = st.UpdateChannel(ctx, store.UpdateChannelInput{
		ChannelID:        created.ID,
		UserID:           owner.ID,
		PullRequestURL:   &pullRequestURL,
		PullRequestTitle: &pullRequestTitle,
	})
	if err != nil {
		t.Fatal(err)
	}
	if updated.PullRequestURL != pullRequestURL || updated.PullRequestTitle != pullRequestTitle {
		t.Fatalf("pull request context did not update: %#v", updated)
	}
	nonCanonicalPullRequestURL := pullRequestURL + "/"
	updated, _, err = st.UpdateChannel(ctx, store.UpdateChannelInput{
		ChannelID:      created.ID,
		UserID:         owner.ID,
		PullRequestURL: &nonCanonicalPullRequestURL,
	})
	if err != nil {
		t.Fatal(err)
	}
	if updated.PullRequestURL != pullRequestURL || updated.PullRequestTitle != pullRequestTitle {
		t.Fatalf("equivalent pull request URL reset context: %#v", updated)
	}
	planBody := "1. Inspect the failure\n2. Patch the adapter\n3. Verify the room"
	goalBody := "Ship a reconnect-safe ClickClack adapter"
	updated, _, err = st.UpdateCodeWorkspaceNotes(ctx, store.UpdateCodeWorkspaceNotesInput{
		ChannelID:   created.ID,
		ActorUserID: owner.ID,
		PlanBody:    &planBody,
		GoalBody:    &goalBody,
	})
	if err != nil {
		t.Fatal(err)
	}
	if updated.PlanBody != planBody || updated.GoalBody != goalBody {
		t.Fatalf("workspace notes did not update: %#v", updated)
	}
	if _, _, err := st.UpdateCodeWorkspaceNotes(ctx, store.UpdateCodeWorkspaceNotesInput{ChannelID: created.ID, ActorUserID: moderator.ID, PlanBody: &planBody}); err == nil {
		t.Fatal("expected non-owner human workspace note mutation to remain forbidden")
	}
	bot, _, err := st.CreateBot(ctx, store.CreateBotInput{
		WorkspaceID: workspace.ID,
		OwnerUserID: owner.ID,
		DisplayName: "Chisel",
		Handle:      "chisel-code-room",
		TokenName:   "code-room",
		Scopes:      []string{"bot:write"},
		CreatedBy:   owner.ID,
	})
	if err != nil {
		t.Fatal(err)
	}
	agentPlan := planBody + "\n4. Post the result"
	updated, _, err = st.UpdateCodeWorkspaceNotes(ctx, store.UpdateCodeWorkspaceNotesInput{
		ChannelID:   created.ID,
		ActorUserID: bot.ID,
		PlanBody:    &agentPlan,
	})
	if err != nil {
		t.Fatal(err)
	}
	if updated.PlanBody != agentPlan || updated.GoalBody != goalBody {
		t.Fatalf("owner-scoped agent did not preserve and update workspace notes: %#v", updated)
	}
	profile, err := st.UpsertBotRuntimeProfile(ctx, store.UpsertBotRuntimeProfileInput{
		WorkspaceID: workspace.ID,
		BotUserID:   bot.ID,
		ActorUserID: bot.ID,
		Harness:     "OpenClaw",
		Model:       "GPT-5.6-Sol",
		Thinking:    "high",
	})
	if err != nil {
		t.Fatal(err)
	}
	profiles, err := st.ListBotRuntimeProfiles(ctx, workspace.ID, owner.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(profiles) != 1 || profiles[0] != profile {
		t.Fatalf("unexpected runtime profile round trip: %#v", profiles)
	}
	persisted, err := st.GetChannel(ctx, created.ID, owner.ID)
	if err != nil {
		t.Fatal(err)
	}
	if persisted.CodeMode != store.ChannelCodeModeSingleUser || persisted.Template != store.ChannelTemplateCode || persisted.PullRequestURL != pullRequestURL || persisted.PlanBody != agentPlan || persisted.GoalBody != goalBody {
		t.Fatalf("presentation did not persist: %#v", persisted)
	}
	updated, _, err = st.UpdateChannel(ctx, store.UpdateChannelInput{ChannelID: created.ID, UserID: owner.ID, Template: store.ChannelTemplateChat})
	if err != nil {
		t.Fatal(err)
	}
	if updated.PullRequestURL != "" || updated.PullRequestTitle != "" {
		t.Fatalf("chat template retained code context: %#v", updated)
	}

	if _, _, err := st.CreateChannel(ctx, store.CreateChannelInput{WorkspaceID: workspace.ID, UserID: owner.ID, Name: "invalid", Template: "dashboard"}); !errors.Is(err, store.ErrInvalidChannelPresentation) {
		t.Fatalf("expected invalid template rejection, got %v", err)
	}
	if _, _, err := st.CreateChannel(ctx, store.CreateChannelInput{WorkspaceID: workspace.ID, UserID: owner.ID, Name: "invalid-chat-mode", Template: store.ChannelTemplateChat, CodeMode: store.ChannelCodeModeMultiUser}); !errors.Is(err, store.ErrInvalidChannelPresentation) {
		t.Fatalf("expected multi-user chat channel rejection, got %v", err)
	}
	if _, _, err := st.UpdateChannel(ctx, store.UpdateChannelInput{ChannelID: created.ID, UserID: owner.ID, CodeMode: "everyone"}); !errors.Is(err, store.ErrInvalidChannelPresentation) {
		t.Fatalf("expected invalid code mode rejection, got %v", err)
	}
	if _, _, err := st.UpdateChannel(ctx, store.UpdateChannelInput{ChannelID: created.ID, UserID: owner.ID, Template: store.ChannelTemplateChat, CodeMode: store.ChannelCodeModeMultiUser}); !errors.Is(err, store.ErrInvalidChannelPresentation) {
		t.Fatalf("expected multi-user chat update rejection, got %v", err)
	}
}
