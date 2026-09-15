# Agora-BBS 接口文档与 Apifox 导入说明

## 1. 文件说明

- `Agora-BBS.openapi.yaml`：OpenAPI 3.0.3 规范，是当前项目 API 的唯一公共契约，可直接导入 Apifox、Swagger Editor、Postman 等工具。
- 规范覆盖用户端、管理端共 42 个 HTTP 操作，包含请求参数、JSON 请求体、JWT 鉴权、分页、筛选、排序、统一响应模型和示例数据。
- 文档不包含 `backend/.env` 中的 LLM Key、QQ 邮箱授权码或其他本地秘密。

## 2. 导入 Apifox

1. 打开 Apifox，进入“导入项目”或已有项目的“项目设置 → 导入数据”。
2. 选择“OpenAPI/Swagger”。
3. 选择“文件导入”，打开本目录下的 `Agora-BBS.openapi.yaml`。
4. 数据覆盖方式建议选择“智能合并”；第一次导入可直接使用默认选项。
5. 导入后确认环境基址为 `http://localhost:8080/api/v1`。

如果老师从校园网中的另一台电脑访问，把 Apifox 环境基址改成：

```text
http://演示电脑当前IPv4:8080/api/v1
```

当前规范里校园网示例 IP 只是默认值。网络变化后可运行项目的 `scripts/demo-check.ps1` 获取当前地址，无需为了测试接口修改后端代码。

## 3. 在 Apifox 中配置 JWT

普通用户：

1. 调用 `POST /auth/login`。
2. 从响应中复制 `data.token`。
3. 在 Apifox 项目或接口的“认证”中选择 `Bearer Token`，粘贴该 Token。

管理员：

1. 调用 `POST /auth/login`，取得 `data.challenge_id`。
2. 从管理员邮箱取得六位验证码。
3. 调用 `POST /auth/admin/verify-email`。
4. 将该接口返回的 `data.token` 配置为 Bearer Token，再调用 `/admin/*`。

管理员不能使用密码登录阶段的响应直接访问管理端。不要把真实 JWT、邮箱验证码或 SMTP 授权码写回 OpenAPI 文件或提交到 Git。

## 4. 推荐联调顺序

```text
GET  /ping
POST /auth/login
GET  /users/me
GET  /categories
GET  /topics
GET  /topics/{id}
POST /reading-sessions
PATCH /reading-sessions/{id}/heartbeat
POST /reading-sessions/{id}/complete
```

发帖、回复、语境反馈和盲审受 L0–L3 成长权限约束。接口返回 403 或 409 时，应同时检查用户等级、有效阅读、长文阅读完成状态以及内容是否仍在冷静期，而不应只检查 JWT。

## 5. 响应约定

除 `GET /ping` 外，成功和失败均使用统一信封：

```json
{
  "code": 0,
  "msg": "success",
  "data": {},
  "request_id": "96a086ee-4d3d-482c-98fa-cbd1cff79633"
}
```

分页数据位于 `data`：

```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "page_size": 20
}
```

HTTP 400、401、403、404、409、429、500、503 分别表示请求错误、未登录、无权限、不存在、状态冲突、限流、服务异常和依赖暂不可用。`request_id` 可用于对照 Docker 后端日志排查一次调用。

## 6. 维护规则

新增或修改 Gin 路由、请求 DTO、响应字段时，应同步修改 `Agora-BBS.openapi.yaml`。尤其注意以下容易遗漏的变化：

- `backend/internal/router/router.go` 中的方法和路径；
- `backend/internal/model` 中的 JSON 字段和校验规则；
- 管理端各列表允许的搜索、筛选、排序字段；
- API 响应的 HTTP 状态码和业务错误码；
- 新增接口是否需要普通 JWT 或管理员邮箱验证 JWT。
