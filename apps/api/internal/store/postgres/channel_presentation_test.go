package postgres

import (
	"context"
	"testing"

	"github.com/openclaw/clickclack/apps/api/internal/store"
)

func TestChannelPresentationPostgresRoundTrip(t *testing.T) {
	ctx := context.Background()
	st := newIsolatedPostgresTestStore(t)
	if err := st.Migrate(ctx); err != nil {
		t.Fatal(err)
	}
	owner, err := st.CreateUser(ctx, store.CreateUserInput{DisplayName: "Owner", Email: "pg-code-channel@example.com"})
	if err != nil {
		t.Fatal(err)
	}
	workspace, err := st.CreateWorkspace(ctx, store.CreateWorkspaceInput{Name: "Code Channel", Slug: "pg-code-channel"}, owner.ID)
	if err != nil {
		t.Fatal(err)
	}
	created, _, err := st.CreateChannel(ctx, store.CreateChannelInput{
		WorkspaceID: workspace.ID,
		UserID:      owner.ID,
		Name:        "review-room",
		Template:    store.ChannelTemplateCode,
		CodeMode:    store.ChannelCodeModeMultiUser,
	})
	if err != nil {
		t.Fatal(err)
	}
	got, err := st.GetChannel(ctx, created.ID, owner.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.Template != store.ChannelTemplateCode || got.CodeMode != store.ChannelCodeModeMultiUser {
		t.Fatalf("unexpected PostgreSQL code channel: %#v", got)
	}
}
