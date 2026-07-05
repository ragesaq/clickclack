package sqlite

import (
	"context"
	"testing"

	"github.com/openclaw/clickclack/apps/api/internal/store"
)

// PsiClawOps fork: message provenance columns (0900/0901 migrations) survive an
// insert/read cycle and default to empty for ordinary messages.
func TestCreateMessagePersistsProvenance(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	st := newTestStore(t)
	owner, err := st.EnsureBootstrap(ctx, "Owner", "owner@example.com")
	if err != nil {
		t.Fatal(err)
	}
	workspaces, err := st.ListWorkspaces(ctx, owner.ID)
	if err != nil {
		t.Fatal(err)
	}
	channels, err := st.ListChannels(ctx, workspaces[0].ID, owner.ID)
	if err != nil {
		t.Fatal(err)
	}
	channel := channels[0]

	msg, _, err := st.CreateMessage(ctx, store.CreateMessageInput{
		ChannelID:      channel.ID,
		AuthorID:       owner.ID,
		Body:           "provenance carrier",
		AuthorModel:    "anthropic/claude-opus-4-8",
		AuthorThinking: "xhigh",
		AuthorRuntime:  "native",
	})
	if err != nil {
		t.Fatalf("CreateMessage: %v", err)
	}
	if msg.AuthorModel != "anthropic/claude-opus-4-8" || msg.AuthorThinking != "xhigh" || msg.AuthorRuntime != "native" {
		t.Fatalf("provenance not persisted: %+v", msg)
	}

	// Read back through the shared select path.
	got, err := st.GetMessage(ctx, msg.ID, owner.ID)
	if err != nil {
		t.Fatalf("GetMessage: %v", err)
	}
	if got.AuthorModel != msg.AuthorModel || got.AuthorThinking != msg.AuthorThinking || got.AuthorRuntime != msg.AuthorRuntime {
		t.Fatalf("provenance lost on read: %+v", got)
	}

	// Plain messages stay blank.
	plain, _, err := st.CreateMessage(ctx, store.CreateMessageInput{ChannelID: channel.ID, AuthorID: owner.ID, Body: "no provenance"})
	if err != nil {
		t.Fatalf("CreateMessage plain: %v", err)
	}
	if plain.AuthorModel != "" || plain.AuthorThinking != "" || plain.AuthorRuntime != "" {
		t.Fatalf("plain message unexpectedly carries provenance: %+v", plain)
	}
}
