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
