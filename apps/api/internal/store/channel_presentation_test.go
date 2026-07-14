package store

import (
	"errors"
	"testing"
)

func TestNormalizeChannelPresentation(t *testing.T) {
	t.Parallel()

	for _, test := range []struct {
		name  string
		input string
		want  string
		norm  func(string) (string, error)
	}{
		{name: "default template", want: ChannelTemplateChat, norm: NormalizeChannelTemplate},
		{name: "code template", input: ChannelTemplateCode, want: ChannelTemplateCode, norm: NormalizeChannelTemplate},
		{name: "default code mode", want: ChannelCodeModeSingleUser, norm: NormalizeChannelCodeMode},
		{name: "multi-user code mode", input: ChannelCodeModeMultiUser, want: ChannelCodeModeMultiUser, norm: NormalizeChannelCodeMode},
	} {
		t.Run(test.name, func(t *testing.T) {
			got, err := test.norm(test.input)
			if err != nil || got != test.want {
				t.Fatalf("normalize %q: got %q, %v; want %q", test.input, got, err, test.want)
			}
		})
	}

	for _, norm := range []func(string) (string, error){NormalizeChannelTemplate, NormalizeChannelCodeMode} {
		if _, err := norm("unsupported"); !errors.Is(err, ErrInvalidChannelPresentation) {
			t.Fatalf("expected ErrInvalidChannelPresentation, got %v", err)
		}
	}

	if err := ValidateChannelPresentation(ChannelTemplateCode, ChannelCodeModeMultiUser); err != nil {
		t.Fatalf("expected multi-user code channel to be valid: %v", err)
	}
	if err := ValidateChannelPresentation(ChannelTemplateChat, ChannelCodeModeMultiUser); !errors.Is(err, ErrInvalidChannelPresentation) {
		t.Fatalf("expected multi-user chat channel to be rejected, got %v", err)
	}
}

func TestNormalizePullRequestContext(t *testing.T) {
	t.Parallel()

	url, title, err := NormalizePullRequestContext("https://github.com/PsiClawOps/clickclack-codex-plugin/pull/1", "")
	if err != nil {
		t.Fatal(err)
	}
	if url != "https://github.com/PsiClawOps/clickclack-codex-plugin/pull/1" || title != "PsiClawOps/clickclack-codex-plugin #1" {
		t.Fatalf("unexpected normalized pull request: %q %q", url, title)
	}
	for _, invalid := range []string{
		"http://github.com/openclaw/clickclack/pull/1",
		"https://example.com/openclaw/clickclack/pull/1",
		"https://github.com/openclaw/clickclack/issues/1",
		"https://github.com/openclaw/clickclack/pull/nope",
	} {
		if _, _, err := NormalizePullRequestContext(invalid, ""); !errors.Is(err, ErrInvalidChannelPresentation) {
			t.Fatalf("expected %q to be rejected, got %v", invalid, err)
		}
	}
	if _, _, err := NormalizePullRequestContext("", "orphaned title"); !errors.Is(err, ErrInvalidChannelPresentation) {
		t.Fatalf("expected title without URL to be rejected, got %v", err)
	}
}
