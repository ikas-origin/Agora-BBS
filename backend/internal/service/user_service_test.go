package service

import (
	"regexp"
	"slices"
	"testing"

	"agora-backend/internal/model"
)

func TestNewAdminChallenge(t *testing.T) {
	id, code, err := newAdminChallenge()
	if err != nil {
		t.Fatal(err)
	}
	if len(id) != 48 {
		t.Fatalf("challenge id length = %d", len(id))
	}
	if !regexp.MustCompile(`^[0-9]{6}$`).MatchString(code) {
		t.Fatalf("invalid code format")
	}
	if adminCodeHash("secret", id, code) == adminCodeHash("secret", id, "000000") && code != "000000" {
		t.Fatal("different codes produced the same hash")
	}
}

func TestMaskEmail(t *testing.T) {
	if got := maskEmail("admin@example.com"); got != "a***@example.com" {
		t.Fatalf("maskEmail() = %q", got)
	}
	if got := maskEmail("invalid"); got != "***" {
		t.Fatalf("invalid email mask = %q", got)
	}
}

func TestDecorateUserBlindReviewCapability(t *testing.T) {
	tests := []struct {
		name string
		user model.User
		want bool
	}{
		{name: "L2 user remains locked", user: model.User{UnlockLevel: 2, Role: "user"}, want: false},
		{name: "L3 user can review", user: model.User{UnlockLevel: 3, Role: "user"}, want: true},
		{name: "administrator follows backend permission", user: model.User{UnlockLevel: 0, Role: "admin"}, want: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			decorateUser(&tt.user)
			got := slices.Contains(tt.user.Capabilities, "blind_review")
			if got != tt.want {
				t.Fatalf("blind_review capability = %v, want %v; capabilities=%v", got, tt.want, tt.user.Capabilities)
			}
			if slices.Contains(tt.user.Capabilities, "review") {
				t.Fatalf("legacy capability name leaked: %v", tt.user.Capabilities)
			}
		})
	}
}
