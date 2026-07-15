package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/openclaw/clickclack/apps/api/internal/store"
)

type pullRequestStatus struct {
	State           string `json:"state"`
	CIState         string `json:"ci_state"`
	ChecksTotal     int    `json:"checks_total"`
	ReviewState     string `json:"review_state"`
	LastReplyAuthor string `json:"last_reply_author"`
	LastReplyAt     string `json:"last_reply_at"`
	UpdatedAt       string `json:"updated_at"`
}

type githubPullRequest struct {
	State     string `json:"state"`
	Draft     bool   `json:"draft"`
	MergedAt  string `json:"merged_at"`
	UpdatedAt string `json:"updated_at"`
	User      struct {
		Login string `json:"login"`
	} `json:"user"`
	Head struct {
		SHA string `json:"sha"`
	} `json:"head"`
}

type githubConversationEntry struct {
	State       string `json:"state"`
	CreatedAt   string `json:"created_at"`
	SubmittedAt string `json:"submitted_at"`
	User        struct {
		Login string `json:"login"`
	} `json:"user"`
}

type githubCheckRuns struct {
	TotalCount int `json:"total_count"`
	CheckRuns  []struct {
		Status     string `json:"status"`
		Conclusion string `json:"conclusion"`
	} `json:"check_runs"`
}

type githubCombinedStatus struct {
	State    string `json:"state"`
	Statuses []struct {
		State string `json:"state"`
	} `json:"statuses"`
}

func (s *Server) getPullRequestStatus(w http.ResponseWriter, r *http.Request) {
	act, err := s.currentActor(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, err)
		return
	}
	if err := act.requireScope("channels:read"); err != nil {
		writeError(w, http.StatusForbidden, err)
		return
	}
	channel, err := s.store.GetChannel(r.Context(), chi.URLParam(r, "channel_id"), act.user.ID)
	if err != nil {
		writeResult(w, nil, err)
		return
	}
	if channel.Template != store.ChannelTemplateCode || channel.PullRequestURL == "" {
		writeError(w, http.StatusBadRequest, errors.New("code channel has no linked pull request"))
		return
	}
	status, err := s.loadPullRequestStatus(r.Context(), channel.PullRequestURL)
	if err != nil {
		writeError(w, http.StatusBadGateway, errors.New("could not read linked pull request"))
		return
	}
	writeResult(w, map[string]any{"pull_request": status}, nil)
}

func (s *Server) loadPullRequestStatus(parent context.Context, rawURL string) (pullRequestStatus, error) {
	canonical, _, err := store.NormalizePullRequestContext(rawURL, "")
	if err != nil {
		return pullRequestStatus{}, err
	}
	parsed, err := url.Parse(canonical)
	if err != nil {
		return pullRequestStatus{}, err
	}
	parts := strings.Split(strings.Trim(parsed.Path, "/"), "/")
	apiBase := fmt.Sprintf("https://api.github.com/repos/%s/%s", parts[0], parts[1])
	pullNumber := parts[3]
	ctx, cancel := context.WithTimeout(parent, 12*time.Second)
	defer cancel()

	var pull githubPullRequest
	if err := s.getGitHubJSON(ctx, apiBase+"/pulls/"+pullNumber, &pull); err != nil {
		return pullRequestStatus{}, err
	}
	status := pullRequestStatus{
		State:           pull.State,
		CIState:         "not_reported",
		ReviewState:     "pending",
		LastReplyAuthor: pull.User.Login,
		LastReplyAt:     pull.UpdatedAt,
		UpdatedAt:       pull.UpdatedAt,
	}
	if pull.Draft {
		status.State = "draft"
	}
	if pull.MergedAt != "" {
		status.State = "merged"
	}

	comments, commentsErr := s.getGitHubConversationEntries(ctx, apiBase+"/issues/"+pullNumber+"/comments?per_page=100")
	if commentsErr == nil {
		for _, comment := range comments {
			status.recordReply(comment.User.Login, comment.CreatedAt)
		}
	}
	reviews, reviewsErr := s.getGitHubConversationEntries(ctx, apiBase+"/pulls/"+pullNumber+"/reviews?per_page=100")
	if reviewsErr == nil {
		latestReviewByUser := map[string]githubConversationEntry{}
		for _, review := range reviews {
			status.recordReply(review.User.Login, review.SubmittedAt)
			if previous, ok := latestReviewByUser[review.User.Login]; !ok || review.SubmittedAt > previous.SubmittedAt {
				latestReviewByUser[review.User.Login] = review
			}
		}
		approved := false
		for _, review := range latestReviewByUser {
			switch strings.ToLower(review.State) {
			case "changes_requested":
				status.ReviewState = "changes_requested"
				approved = false
				goto reviewDone
			case "approved":
				approved = true
			}
		}
		if approved {
			status.ReviewState = "approved"
		}
	}

reviewDone:
	if pull.Head.SHA != "" {
		var checks githubCheckRuns
		checksErr := s.getGitHubJSON(ctx, apiBase+"/commits/"+pull.Head.SHA+"/check-runs?per_page=100", &checks)
		var combined githubCombinedStatus
		combinedErr := s.getGitHubJSON(ctx, apiBase+"/commits/"+pull.Head.SHA+"/status", &combined)
		status.CIState, status.ChecksTotal = summarizeGitHubCI(checks, checksErr, combined, combinedErr)
	}
	return status, nil
}

func (status *pullRequestStatus) recordReply(author, at string) {
	if author != "" && at != "" && at >= status.LastReplyAt {
		status.LastReplyAuthor = author
		status.LastReplyAt = at
	}
}

func summarizeGitHubCI(checks githubCheckRuns, checksErr error, combined githubCombinedStatus, combinedErr error) (string, int) {
	total := checks.TotalCount
	if total == 0 && combinedErr == nil {
		total = len(combined.Statuses)
	}
	if checksErr != nil && combinedErr != nil {
		return "unknown", 0
	}
	failing := false
	pending := false
	for _, check := range checks.CheckRuns {
		if check.Status != "completed" {
			pending = true
		}
		switch check.Conclusion {
		case "failure", "cancelled", "timed_out", "action_required", "startup_failure":
			failing = true
		}
	}
	if combinedErr == nil {
		switch combined.State {
		case "failure", "error":
			failing = true
		case "pending":
			pending = true
		}
	}
	if failing {
		return "failing", total
	}
	if pending {
		return "pending", total
	}
	if total > 0 || (combinedErr == nil && combined.State == "success") {
		return "passing", total
	}
	return "not_reported", 0
}

func (s *Server) getGitHubJSON(ctx context.Context, endpoint string, target any) error {
	_, err := s.getGitHubJSONWithHeaders(ctx, endpoint, target)
	return err
}

func (s *Server) getGitHubConversationEntries(ctx context.Context, endpoint string) ([]githubConversationEntry, error) {
	entries := make([]githubConversationEntry, 0)
	next := endpoint
	for page := 0; page < 10 && next != ""; page++ {
		var pageEntries []githubConversationEntry
		headers, err := s.getGitHubJSONWithHeaders(ctx, next, &pageEntries)
		if err != nil {
			return nil, err
		}
		entries = append(entries, pageEntries...)
		next = githubLink(headers.Get("Link"), "next")
	}
	if next != "" {
		return nil, errors.New("github conversation exceeds pagination limit")
	}
	return entries, nil
}

func githubLink(header, relation string) string {
	for _, item := range strings.Split(header, ",") {
		parts := strings.Split(strings.TrimSpace(item), ";")
		if len(parts) < 2 {
			continue
		}
		for _, parameter := range parts[1:] {
			if strings.TrimSpace(parameter) == `rel="`+relation+`"` {
				return strings.Trim(strings.TrimSpace(parts[0]), "<>")
			}
		}
	}
	return ""
}

func (s *Server) getGitHubJSONWithHeaders(ctx context.Context, endpoint string, target any) (http.Header, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", "clickclack-code-workspace")
	if s.githubOAuth.APIToken != "" {
		req.Header.Set("Authorization", "Bearer "+s.githubOAuth.APIToken)
	}
	response, err := s.githubOAuth.HTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(response.Body, 2048))
		return nil, fmt.Errorf("github returned %s: %s", response.Status, strings.TrimSpace(string(body)))
	}
	if err := json.NewDecoder(io.LimitReader(response.Body, 2<<20)).Decode(target); err != nil {
		return nil, err
	}
	return response.Header.Clone(), nil
}
