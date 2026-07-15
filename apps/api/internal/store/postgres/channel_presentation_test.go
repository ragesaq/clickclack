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
	planBody := "Inspect, patch, verify"
	goalBody := "Keep the project room current"
	got, _, err = st.UpdateCodeWorkspaceNotes(ctx, store.UpdateCodeWorkspaceNotesInput{
		ChannelID:   created.ID,
		ActorUserID: owner.ID,
		PlanBody:    &planBody,
		GoalBody:    &goalBody,
	})
	if err != nil {
		t.Fatal(err)
	}
	if got.PlanBody != planBody || got.GoalBody != goalBody {
		t.Fatalf("unexpected PostgreSQL workspace notes: %#v", got)
	}
}
