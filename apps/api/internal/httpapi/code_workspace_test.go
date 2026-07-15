package httpapi

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"
)

func TestLoadPullRequestStatusSummarizesLiveGitHubState(t *testing.T) {
	t.Parallel()
	server := &Server{githubOAuth: GitHubOAuthConfig{APIToken: "private-repo-token", HTTPClient: &http.Client{Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
		if req.Header.Get("Authorization") != "Bearer private-repo-token" {
			t.Fatalf("missing GitHub API authorization header")
		}
		body := `{}`
		header := make(http.Header)
		switch {
		case strings.HasSuffix(req.URL.Path, "/pulls/17"):
			body = `{"state":"open","draft":false,"merged_at":null,"updated_at":"2026-07-15T01:00:00Z","user":{"login":"author"},"head":{"sha":"abc123"}}`
		case strings.HasSuffix(req.URL.Path, "/issues/17/comments"):
			if req.URL.Query().Get("page") == "2" {
				body = `[{"created_at":"2026-07-15T01:25:00Z","user":{"login":"operator-two"}}]`
			} else {
				body = `[{"created_at":"2026-07-15T01:10:00Z","user":{"login":"operator"}}]`
				header.Set("Link", `<https://api.github.com/repos/PsiClawOps/clickclack/issues/17/comments?per_page=100&page=2>; rel="next", <https://api.github.com/repos/PsiClawOps/clickclack/issues/17/comments?per_page=100&page=2>; rel="last"`)
			}
		case strings.HasSuffix(req.URL.Path, "/pulls/17/reviews"):
			body = `[{"state":"APPROVED","submitted_at":"2026-07-15T01:20:00Z","user":{"login":"reviewer"}}]`
		case strings.HasSuffix(req.URL.Path, "/check-runs"):
			body = `{"total_count":2,"check_runs":[{"status":"completed","conclusion":"success"},{"status":"completed","conclusion":"success"}]}`
		case strings.HasSuffix(req.URL.Path, "/status"):
			body = `{"state":"success","statuses":[{"state":"success"}]}`
		}
		return &http.Response{
			StatusCode: http.StatusOK,
			Status:     "200 OK",
			Header:     header,
			Body:       io.NopCloser(strings.NewReader(body)),
			Request:    req,
		}, nil
	})}}}

	status, err := server.loadPullRequestStatus(context.Background(), "https://github.com/PsiClawOps/clickclack/pull/17")
	if err != nil {
		t.Fatal(err)
	}
	if status.State != "open" || status.CIState != "passing" || status.ChecksTotal != 2 || status.ReviewState != "approved" {
		t.Fatalf("unexpected pull request summary: %#v", status)
	}
	if status.LastReplyAuthor != "operator-two" || status.LastReplyAt != "2026-07-15T01:25:00Z" {
		t.Fatalf("unexpected last reply summary: %#v", status)
	}
}

func TestSummarizeGitHubCIPrioritizesFailures(t *testing.T) {
	t.Parallel()
	checks := githubCheckRuns{TotalCount: 2}
	checks.CheckRuns = append(checks.CheckRuns,
		struct {
			Status     string `json:"status"`
			Conclusion string `json:"conclusion"`
		}{Status: "completed", Conclusion: "success"},
		struct {
			Status     string `json:"status"`
			Conclusion string `json:"conclusion"`
		}{Status: "completed", Conclusion: "failure"},
	)
	state, total := summarizeGitHubCI(checks, nil, githubCombinedStatus{State: "failure"}, nil)
	if state != "failing" || total != 2 {
		t.Fatalf("unexpected CI summary: %q %d", state, total)
	}
}
