# Octura 1.0 产品规格：详细记录与展示

**状态**：Release Candidate  
**Schema**：`octura.record.v1` / `octura.capture.v1` / `octura.api.v1`

## 产品定义

Octura 是本地优先的 AI 软件开发记录工作台。它保存开发活动的完整可见对话、结构化成果、来源和人工审核声明，让团队能够回答：为什么做、谁做了什么、证据来自哪里、哪些内容经过确认。

Octura 不执行代码，不替代 Codex、Cursor、Claude Code、GitHub 或 CI，也不管理 Document Revision、Requirement 状态机、Product Version、Task Pack、同步或执行门禁。

## 核心用户旅程

### P1：Agent 批量记录一次活动

Agent 先读取 `octura-record-prompt --json`，再把完整可见消息和一到多条 Record 通过 `octura-capture-add` 原子写入。任一消息或 Record 不合法时，本次 Capture 整体失败，不留下半条 Session。

### P1：长任务实时记录

Agent 创建 open Session，按服务端 `nextSequence` 追加消息，任务结束时一次提交成果 Record 并关闭 Session。关闭后的 Session 不可修改；取消的任务用 `abandoned` 和原因结束。

### P1：阅读和判断事实

用户在 Web 工作台搜索、筛选 Record，打开详细结果及其原始 Session。所有 Record 初始为 `captured`；用户可以确认、忽略，或撤回已经确认的判断。

### P1：修正错误记录

用户创建 replacement Record 取代 captured 或 reviewed Record。原记录保留为 `superseded`，replacement 从 `captured` 开始，不继承旧记录的审核状态。

## 核心对象与状态

- `Project`：记录归属空间。
- `Session`：一次完整可见开发活动；状态为 `open → closed|abandoned`。
- `Message`：Session 中按 sequence 排序的 `user|assistant|system|tool` 可见内容。
- `Record`：一个独立可读的成果；状态为 `captured|reviewed|dismissed|retracted|superseded`。
- `ReviewEvent`：追加式 `confirm|dismiss|retract` 事件。
- `SupersedeRelation`：predecessor 与 replacement 之间的一对一取代关系。

Record 不提供 update 或 delete。Session 关闭后不提供 reopen、append 或 edit。

## 记录契约

Record 必须包含：

- `kind`：`summary|requirement|decision|change|test|verification|release`；
- `outcomeStatus`：`completed|partial|blocked`；
- `intent.goal`，以及可选 constraints、acceptance；
- Markdown `result`；
- 结构化 changes、decisions、verification、risks、nextSteps、externalRefs；
- `provenance`：truth、sourceType/sourceName、actorType/actorName；
- `occurredAt` 和 `idempotencyKey`。

验证状态只能是 `passed|failed|not_run|unknown`。Agent 根据 Session 整理的成果使用 `truth=derived`；原始文档、构建或人工输入才使用 `raw`。

## 安全边界

- 只接受可见角色，不接受 `analysis`、`reasoning` 或隐藏思维链。
- 单条消息最多 256 KiB，单 Session 最多 10 MiB，单次 Capture 最多 2,000 条消息和 20 条 Record。
- 高置信度私钥、OpenAI/GitHub/AWS key 和显式凭证赋值会返回 `sensitive_content`，调用者必须脱敏后重试。
- 不保存二进制附件；通过 externalRefs 指向文件、commit、PR、issue、build 或 URL。

## 幂等与并发

所有采集、追加、关闭、Record、审核和取代写操作必须带幂等键。相同操作、键和请求返回原结果并标记 `idempotentReplay=true`；复用键提交不同内容返回 `idempotency_conflict`。

实时 append 还必须提交 `expectedSequence`。与服务端下一序号不一致时返回 `sequence_conflict`，不写入任何消息。

## 审核语义

采集接口永远不能直接生成 reviewed Record。审核请求必须单独提供 action、reviewer、`attestation=human_reviewed`、note 和 idempotencyKey。

单机版不提供账号系统。任何入口都可以提交审核声明，但 Web 必须展示 `identityAssurance=self_asserted` 和调用 surface；“已确认”表示收到具名声明，不表示 Octura 已验证真实身份。

## 公共入口

### HTTP API

所有稳定接口位于 `/api/v1`：

```text
GET  /protocols/record
GET|POST /projects
GET  /projects/:slug/dashboard
POST /projects/:slug/captures
GET|POST /projects/:slug/sessions
GET  /projects/:slug/sessions/:id
POST /projects/:slug/sessions/:id/messages
POST /projects/:slug/sessions/:id/close
GET|POST /projects/:slug/records
GET  /projects/:slug/records/:id
POST /projects/:slug/records/:id/reviews
POST /projects/:slug/records/:id/supersede
```

### CLI 与 MCP

独立 CLI 是公开稳定入口；`octura <domain> <action>` 仅作为兼容入口。MCP 使用本地 stdio，提供 project、protocol、batch capture、realtime session、record query/review/supersede 工具，并直接调用相同应用服务。

## 展示要求

- 项目概览只展示实际数量：Records、reviewed、captured、Sessions 和来源；不生成证据覆盖率。
- 时间线支持状态、类型、关键词和游标分页。
- Record 详情展示所有结构化章节、来源、Session、审核历史和取代链。
- Session 详情展示完整可见消息与成果 Record。
- 系统文案支持中文和英文；采集内容保持原语言。
- 390px 和桌面宽度下必须完成核心阅读与审核流程。

## 非目标

1.0 不提供账号、权限、租户、云同步、托管、模型调用、Agent 执行、CI 调度、通用关系图谱或 Spec Kit 导入。Spec Kit 兼容实现继续保留在独立分支。

## 发布验收

干净 Docker volume 可以启动；项目、批量 Capture、实时 Session、搜索、详情、审核、撤回和取代全部通过 API/CLI；MCP 可以 initialize/list tools/call；重启后数据保留；非法状态、幂等冲突、序号冲突、敏感内容和事务回滚均有验证。
