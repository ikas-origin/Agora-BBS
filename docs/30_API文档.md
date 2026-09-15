# Agora-BBS API 使用说明

规范文件为 `docs/apifox/Agora-BBS.openapi.yaml`，可直接导入 Apifox；导入步骤见 `docs/apifox/README.md`。本文件解释常用流程，默认基址为 `http://localhost:8080/api/v1`。

## 1. 通用约定

成功和失败都使用统一信封：

```json
{"code":0,"msg":"ok","data":{},"request_id":"a1b2c3"}
```

分页 `data` 固定为：

```json
{"items":[],"total":0,"page":1,"page_size":20}
```

需要登录的接口使用 `Authorization: Bearer <JWT>`。HTTP 400/401/403/404/409/429/500 分别表示请求错误、未登录、无权限、不存在、状态冲突、限流和服务异常。普通用户响应不包含具体信任分。

用户能力字段采用固定标识：`browse`、`bookmark`、`reply`、`feedback`、`create_topic`、`blind_review`；管理员还包含 `admin`。其中 L3 匿名盲审能力统一使用 `blind_review`。

## 2. 接口总览

| 方法与路径 | 权限 | 说明 |
| --- | --- | --- |
| `POST /auth/register` | 公开 | 注册并返回 JWT；新用户为 L0 |
| `POST /auth/login` | 公开 | 统一登录；管理员返回邮箱验证挑战 |
| `POST /auth/admin/verify-email` | 公开 | 校验管理员邮箱验证码并签发管理 JWT |
| `GET /users/me` | 登录 | 资料、等级、能力和解锁进度 |
| `GET /users/me/contents` | 登录 | 当前用户主题/回复及状态分页 |
| `PUT /users/me/onboarding` | 登录 | 提交社区自述并触发盲审 |
| `GET /categories` | 公开 | 启用分类 |
| `GET /topics` | 公开 | 已发布主题分页与分类筛选 |
| `GET /search` | 公开 | 主题与回复正文模糊搜索 |
| `POST /topics` | L2 | 创建结构化主题并进入冷静期 |
| `POST /topics/drafts` | 登录 | 保存新主题草稿 |
| `PATCH/DELETE /topics/{id}/draft` | 作者 | 更新或删除草稿 |
| `POST /topics/{id}/publish` | L2/作者 | 将完整草稿提交到冷静期 |
| `GET /topics/{id}` | 公开/作者 | 详情；作者可见自己的冷静中内容 |
| `PATCH /topics/{id}` | 作者 | 冷静期编辑并重新计时 |
| `DELETE /topics/{id}` | 作者 | 冷静期无痕撤回 |
| `GET /topics/{id}/posts` | 公开 | 回复分页，`parent_id` 组成讨论树 |
| `POST /topics/{id}/posts` | L1 | 创建类型化回复 |
| `PATCH /posts/{id}` / `DELETE /posts/{id}` | 作者 | 冷静期编辑/撤回 |
| `GET/PUT/DELETE /bookmarks...` | 登录 | 收藏列表、收藏、取消收藏 |
| `GET /governance/policy` | 公开 | 前端计时和长文规则 |
| `POST /reading-sessions` | 登录 | 开始阅读会话 |
| `PATCH /reading-sessions/{id}/heartbeat` | 登录 | 5 秒心跳、滚动和回复区状态 |
| `POST /reading-sessions/{id}/complete` | 登录 | 完成并汇总有效阅读 |
| `GET /feedbacks/summary` | 公开 | 反馈立场与标签汇总 |
| `POST /feedbacks` / `DELETE /feedbacks/{id}` | L1 | 创建/修改和撤回语境反馈 |
| `GET /topics/{id}/clusters` | 公开 | 动态讨论聚类标签 |
| `GET /reviews/tasks` | L3 | 匿名评审任务 |
| `POST /reviews/tasks/{id}` | L3 | 提交得体度、真诚度和理由 |
| `/admin/*` | 管理员 | 统计、用户、信任、内容、分类、LLM 作业 |

旧 `/likes` 接口仅兼容历史客户端，已废弃；新前端不展示一键点赞。

## 3. 注册和登录

```http
POST /api/v1/auth/register
Content-Type: application/json

{"username":"alice","password":"password123","email":"alice@example.com"}
```

普通用户响应 `data` 为 `{token,user}`。管理员密码正确后不会立即签发 Token，而是返回：

```json
{"requires_email_verification":true,"challenge_id":"...","masked_email":"a***@example.com","expires_in_seconds":600}
```

随后提交 `POST /auth/admin/verify-email`：

```json
{"challenge_id":"...","code":"123456"}
```

验证码 10 分钟有效、最多尝试 5 次；成功后返回 `{token,user}`。管理员接口还会检查 JWT 中的邮箱验证声明，旧 Token 不能绕过二次验证。开发环境未配置 SMTP 时响应会包含仅供本地演示的 `development_verification_code`；生产环境绝不返回验证码，且 SMTP 未配置时拒绝管理员登录。

## 4. 结构化发帖与冷静期

```http
POST /api/v1/topics
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "category_id": 1,
  "title": "关于社区协作的一点观察",
  "structured_content": {
    "claim": "核心观点至少五个字",
    "evidence": "支持依据，可为空",
    "uncertainty": "仍不确定之处，可为空"
  }
}
```

响应包含 `topic_id`、`status=cooling` 和 `cooling_ends_at`。开发默认冷静期 60 秒，生产默认 300 秒。作者可在到期前 PATCH 或 DELETE；普通内容到期发布，长文或高争议分类转为 `pending_review`。

登录用户可以先通过 `POST /topics/drafts` 保存不完整草稿，不要求已达到 L2。草稿状态为 `draft`，仅作者可见；使用 `PATCH /topics/{id}/draft` 继续保存，达到 L2 且标题、核心观点完整后通过 `POST /topics/{id}/publish` 提交。`GET /users/me/contents?type=topic|post&status=draft&page=1&page_size=10` 用于个人内容管理。

公开搜索使用 `GET /search?q=关键词&type=topic|post&page=1&page_size=10`。关键词为 2–100 字，省略 `type` 时同时模糊匹配已发布主题的标题、观点、依据、不确定性及已发布回复；草稿、冷静中和隐藏内容不会进入搜索结果。

回复请求：

```json
{"content":"我的补充依据……","parent_id":12,"post_type":"evidence"}
```

`post_type` 可选 `debate`、`evidence`、`experience`、`thanks`。

## 5. 阅读会话

开始：`POST /reading-sessions`。阅读论坛主题时请求体为 `{"topic_id":1}`；阅读论坛使用手册时为 `{"resource":"forum-guide"}`。主题与系统文档在数据中使用独立的资源类型，不会混淆。每 5 秒发送：

```json
{"progress":85,"reply_focused":true}
```

进度只允许单调增加，服务端限制每次时间增量。普通主题和论坛使用手册滚动到底即可完成；结构化正文总长度不少于公开策略中的 `long_topic_chars`，或分类标记为高争议时，还必须满足回复区停留时间。

开始与心跳响应中的 `requires_reply_dwell` 表示当前主题是否应用停留门槛。完成时应携带浏览器最后状态，页面离开时也可使用同一请求安全收尾：

```json
{"progress":100,"reply_focused":false}
```

未满足条件时，完成接口返回 `completed:false`、`eligible:false` 并保留会话供下次续接；满足条件后的首次请求才会幂等汇总有效时长。服务端随后根据注册时长、累计阅读、合规互动、信任分和自述状态更新等级。

## 6. 语境反馈

```json
{
  "target_type":"post",
  "target_id":32,
  "stance":"challenge",
  "tag":"reasoning_gap",
  "reason":"结论与前述依据之间还缺少关键推导步骤。"
}
```

立场为 `support/challenge`；标签为 `logical`、`new_perspective`、`well_sourced`、`empathetic`、`factual_concern`、`reasoning_gap`、`inappropriate`。理由 5–120 字。同一用户对同一内容重复 POST 会修改原反馈。不能评价自己的内容。

## 7. 匿名盲审

任务不返回作者标识。提交格式：

```json
{"appropriateness":true,"sincerity":true,"reason":"表达克制，说明了依据，也明确承认不确定性。"}
```

两票通过或两票拒绝立即结束批次。每次评审由 LLM 检查公正性并写入信任流水；24 小时无人形成结果时由 LLM 兜底。

## 8. 管理接口

- `GET /admin/overview?days=7|30|90`：增长趋势、用户等级/信任、反馈标签、分类内容规模、盲审和 LLM 汇总。
- `GET /admin/users`、`PATCH /admin/users/{id}`、`PATCH /admin/users/{id}/status`：查看隐藏信任分，编辑用户名、邮箱、身份、状态、等级和信任分，或快捷停用/恢复账号。完整编辑必须填写调整原因，信任分以差额形式写入不可覆盖的 `admin_user_update` 流水；不能停用当前管理员或取消自己的管理员身份。列表支持用户名/邮箱模糊搜索，按角色、状态、L0–L3 筛选，并按注册时间、用户名、等级、信任分或有效阅读时长排序。
- `GET /admin/trust-logs`：不可覆盖的信任流水，可按 `user_id` 精确筛选，或模糊搜索用户名、事件、原因和关联类型；支持按时间、分值变化、用户名或事件排序。
- `GET /admin/contents?type=topic|post`、`PATCH /admin/contents/{type}/{id}/visibility`：隐藏/恢复；不支持修改正文。列表支持搜索标题/正文/作者、状态筛选，以及时间、标题/正文、作者和状态排序。
- `GET/POST/PATCH /admin/categories...`：列出、新增、排序、停用和高争议标记；列表支持搜索名称、slug、说明，并按手工顺序、名称、状态或创建时间排序。
- `GET /admin/llm-jobs`、`POST /admin/llm-jobs/{id}/retry`：用量、错误和失败作业幂等重试；列表支持搜索任务/模型/错误/关联对象、状态筛选，以及时间、延迟、Token、重试次数和状态排序。

管理列表的公共查询参数为 `q`（模糊搜索）、`sort`（排序字段）和 `order=asc|desc`。除分类外均支持 `page/page_size` 分页；服务端对排序字段使用白名单，不会将客户端输入直接拼接为 SQL 标识符。
