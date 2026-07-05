package httpapi

import (
	"context"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"github.com/openclaw/clickclack/apps/api/internal/realtime"
	"github.com/openclaw/clickclack/apps/api/internal/store"
	sqlitestore "github.com/openclaw/clickclack/apps/api/internal/store/sqlite"
)

// PsiClawOps fork: author_model/author_thinking/author_runtime are bot-post
// attribution metadata. A human session supplying any of them fails closed
// (403); a bot with messages:write persists them.
func TestMessageProvenanceAuthz(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	dataDir := t.TempDir()
	st, err := sqlitestore.Open("sqlite://" + filepath.Join(dataDir, "clickclack.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = st.Close() })
	if err := st.Migrate(ctx); err != nil {
		t.Fatal(err)
	}
	owner, err := st.EnsureBootstrap(ctx, "Owner", "owner@example.com")
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
	channel := channels[0]

	bot, botToken, err := st.CreateBot(ctx, store.CreateBotInput{
		WorkspaceID: workspace.ID,
		OwnerUserID: owner.ID,
		DisplayName: "Provenance Bot",
		Scopes:      []string{"bot:write"},
		CreatedBy:   owner.ID,
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := st.AddWorkspaceMember(ctx, workspace.ID, bot.ID, "bot"); err != nil {
		t.Fatal(err)
	}

	server := httptest.NewServer(New(st, realtime.NewHub(), Options{UploadDir: filepath.Join(dataDir, "uploads")}).Handler())
	t.Cleanup(server.Close)
	endpoint := server.URL + "/api/channels/" + channel.ID + "/messages"

	withProvenance := `{"body":"agent line","author_model":"anthropic/claude-opus-4-8","author_thinking":"low","author_runtime":"native"}`
	partialProvenance := `{"body":"agent line 2","author_runtime":"codex"}`

	// Human session supplying provenance fails closed.
	expectStatusAsUser(t, owner.ID, http.MethodPost, endpoint, strings.NewReader(withProvenance), http.StatusForbidden)
	expectStatusAsUser(t, owner.ID, http.MethodPost, endpoint, strings.NewReader(partialProvenance), http.StatusForbidden)

	// Bot persists provenance.
	expectStatusWithBearer(t, botToken.Token, http.MethodPost, endpoint, strings.NewReader(withProvenance), http.StatusCreated)

	page, err := st.ListMessages(ctx, channel.ID, owner.ID, store.MessagePageRequest{Limit: 10})
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, m := range page.Messages {
		if m.Body == "agent line" {
			found = true
			if m.AuthorModel != "anthropic/claude-opus-4-8" || m.AuthorThinking != "low" || m.AuthorRuntime != "native" {
				t.Fatalf("provenance not persisted: %+v", m)
			}
		}
	}
	if !found {
		t.Fatal("bot message with provenance not found")
	}
}
