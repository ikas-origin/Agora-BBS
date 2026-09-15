package service

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"math/big"
	"strings"
	"time"

	"agora-backend/internal/dao"
	"agora-backend/internal/mailer"
	"agora-backend/internal/model"
	"agora-backend/internal/pkg/hash"
	"agora-backend/internal/pkg/jwt"
)

var ErrAdminEmailUnavailable = errors.New("administrator email verification is unavailable")
var ErrInvalidAdminCode = errors.New("invalid or expired administrator verification code")

const adminCodeValidity = 10 * time.Minute

type UserService struct {
	userDAO        *dao.UserDAO
	jwtSecret      string
	jwtExpireHours int
	appEnv         string
	mailer         mailer.Sender
}

func NewUserService(userDAO *dao.UserDAO, jwtSecret string, jwtExpireHours int, appEnv string, sender mailer.Sender) *UserService {
	return &UserService{
		userDAO:        userDAO,
		jwtSecret:      jwtSecret,
		jwtExpireHours: jwtExpireHours,
		appEnv:         appEnv,
		mailer:         sender,
	}
}

func (s *UserService) Register(ctx context.Context, req *model.RegisterReq) (*model.AuthResp, error) {
	// 1. 业务逻辑校验：检查用户名是否已被占用
	existingUser, err := s.userDAO.GetUserByUsername(ctx, req.Username)
	if err != nil {
		return nil, err
	}
	if existingUser != nil {
		return nil, errors.New("username already exists")
	}

	// 2. 调用 pkg/hash 加密密码
	hashedPassword, err := hash.HashPassword(req.Password)
	if err != nil {
		return nil, err
	}

	// 3. 构造 Entity 落库
	user := &model.User{
		Username:     req.Username,
		PasswordHash: hashedPassword,
		Email:        req.Email,
	}
	if err := s.userDAO.CreateUser(ctx, user); err != nil {
		return nil, err
	}
	user, err = s.userDAO.GetUserByID(ctx, user.ID)
	if err != nil || user == nil {
		return nil, errors.New("failed to load created user")
	}
	decorateUser(user)

	// 4. 颁发 JWT Token (有效期 72 小时)
	token, err := jwt.GenerateToken(user.ID, s.jwtSecret, s.jwtExpireHours)
	if err != nil {
		return nil, err
	}

	return &model.AuthResp{Token: token, User: user}, nil
}

func (s *UserService) Login(ctx context.Context, req *model.LoginReq) (*model.LoginResp, error) {
	// 1. 查找用户
	user, err := s.userDAO.GetUserByUsername(ctx, req.Username)
	if err != nil || user == nil {
		return nil, errors.New("invalid username or password")
	}
	if user.Status != "active" {
		return nil, errors.New("account is suspended")
	}
	decorateUser(user)

	// 2. 比对密码
	if !hash.CheckPasswordHash(req.Password, user.PasswordHash) {
		return nil, errors.New("invalid username or password")
	}

	if user.Role == "admin" {
		if strings.TrimSpace(user.Email) == "" {
			return nil, errors.New("administrator account must have an email address")
		}
		challengeID, code, err := newAdminChallenge()
		if err != nil {
			return nil, err
		}
		if err = s.userDAO.CreateAdminLoginChallenge(ctx, challengeID, user.ID, adminCodeHash(s.jwtSecret, challengeID, code), time.Now().Add(adminCodeValidity)); err != nil {
			return nil, err
		}
		if s.mailer == nil || !s.mailer.Configured() {
			if s.appEnv == "production" {
				_ = s.userDAO.DeleteAdminLoginChallenge(ctx, challengeID)
				return nil, ErrAdminEmailUnavailable
			}
		} else if err = s.mailer.SendAdminCode(ctx, user.Email, code, adminCodeValidity); err != nil {
			_ = s.userDAO.DeleteAdminLoginChallenge(ctx, challengeID)
			return nil, fmt.Errorf("%w: %v", ErrAdminEmailUnavailable, err)
		}
		resp := &model.LoginResp{RequiresEmailVerification: true, ChallengeID: challengeID, MaskedEmail: maskEmail(user.Email), ExpiresInSeconds: int(adminCodeValidity.Seconds())}
		// Development keeps the code in the response for deterministic local/E2E
		// verification even when a real SMTP sender is configured. Production
		// never exposes it.
		if s.appEnv != "production" {
			resp.DevelopmentVerificationCode = code
		}
		return resp, nil
	}

	// 3. 普通用户直接生成 Token
	token, err := jwt.GenerateToken(user.ID, s.jwtSecret, s.jwtExpireHours)
	if err != nil {
		return nil, err
	}

	return &model.LoginResp{Token: token, User: user}, nil
}

func (s *UserService) VerifyAdminEmail(ctx context.Context, req *model.VerifyAdminEmailReq) (*model.AuthResp, error) {
	userID, valid, err := s.userDAO.ConsumeAdminLoginChallenge(ctx, req.ChallengeID, adminCodeHash(s.jwtSecret, req.ChallengeID, req.Code))
	if err != nil || !valid {
		if errors.Is(err, sql.ErrNoRows) || !valid {
			return nil, ErrInvalidAdminCode
		}
		return nil, err
	}
	user, err := s.userDAO.GetUserByID(ctx, userID)
	if err != nil || user == nil || user.Role != "admin" || user.Status != "active" {
		return nil, ErrInvalidAdminCode
	}
	decorateUser(user)
	token, err := jwt.GenerateAdminToken(user.ID, s.jwtSecret, s.jwtExpireHours)
	if err != nil {
		return nil, err
	}
	return &model.AuthResp{Token: token, User: user}, nil
}

func newAdminChallenge() (string, string, error) {
	idBytes := make([]byte, 24)
	if _, err := rand.Read(idBytes); err != nil {
		return "", "", err
	}
	n, err := rand.Int(rand.Reader, big.NewInt(1000000))
	if err != nil {
		return "", "", err
	}
	return hex.EncodeToString(idBytes), fmt.Sprintf("%06d", n.Int64()), nil
}

func adminCodeHash(secret, challengeID, code string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(challengeID + ":" + code))
	return hex.EncodeToString(mac.Sum(nil))
}

func maskEmail(email string) string {
	parts := strings.SplitN(email, "@", 2)
	if len(parts) != 2 {
		return "***"
	}
	local := []rune(parts[0])
	visible := "*"
	if len(local) > 0 {
		visible = string(local[0]) + "***"
	}
	return visible + "@" + parts[1]
}

func (s *UserService) GetProfile(ctx context.Context, userID int64) (*model.User, error) {
	user, err := s.userDAO.GetUserByID(ctx, userID)
	if user != nil {
		decorateUser(user)
	}
	return user, err
}

func decorateUser(user *model.User) {
	capabilities := []string{"browse", "bookmark"}
	if user.UnlockLevel >= 1 {
		capabilities = append(capabilities, "reply", "feedback")
	}
	if user.UnlockLevel >= 2 {
		capabilities = append(capabilities, "create_topic")
	}
	if user.UnlockLevel >= 3 || user.Role == "admin" {
		capabilities = append(capabilities, "blind_review")
	}
	if user.Role == "admin" {
		capabilities = append(capabilities, "admin")
	}
	user.Capabilities = capabilities
}
