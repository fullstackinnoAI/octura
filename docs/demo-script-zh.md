# Octura 1.0 五分钟演示脚本

这场演示只说明一件事：Octura 能把一次 AI 开发活动保存成完整可见的 Session、可独立阅读的成果 Record，以及明确的人工审核历史。

## 0. 演示前准备

```bash
docker compose up --build -d
docker compose exec octura octura-doctor --json
docker compose exec octura octura-demo-seed --profile specloop-core --json
```

打开 <http://localhost:3000/?project=specloop-core>，默认使用中文界面。右上角的 `EN` 可切换英文；Record 和 Session 的原始内容不会被翻译。

## 1. 为什么需要 Octura（40 秒）

建议话术：

> AI 工具能快速完成代码，但“用户为什么提出这项工作、Agent 做了什么、结论从哪里来、谁确认过”仍然散落在聊天、终端和人的记忆里。Octura 不接管执行，只详细记录并展示这些事实。

在项目概览中指出 Session、Record、待审核、已确认和来源数量。这些都是数据库中的直接计数，不是模型推断的“证据覆盖率”。

## 2. 查看一次完整开发活动（60 秒）

进入“开发会话”，打开 `SpecLoop Core → Octura 1.0 产品收敛`：

- 用户、Assistant 和 Tool 的可见消息按顺序展示；
- 页面不保存隐藏推理或大段原始工具日志；
- 同一 Session 产生的六条成果可直接跳转到 Record 详情。

建议话术：

> Session 保留上下文，Record 保留离开对话后仍能独立理解的成果。Octura 不让一段摘要替代原始可见对话。

## 3. 展示结构化成果与来源（60 秒）

进入“成果时间线”，打开任一 Record。依次展示：

- 目标、约束与验收条件；
- 结果、变更、决策与验证；
- 风险和下一步；
- 文件、提交或构建引用；
- `raw / derived`、source 和 actor；
- 审核事件与取代链。

强调页面中的提示：审核者身份由本地调用者声明，未经过账号认证。

## 4. 现场写入并审核一条 Record（90 秒）

```bash
docker compose exec octura octura-record-add \
  --project specloop-core \
  --kind decision \
  --title "Octura 1.0 不内置模型调用" \
  --body "Agent 按公开协议生成 Record，Octura 只校验、保存、审核和展示。" \
  --source-type human \
  --source-name live-demo \
  --actor-type human \
  --actor-name presenter \
  --idempotency-key live-demo-no-model-v1 \
  --json
```

回到浏览器，记录会在自动刷新后出现在“待审核”状态。打开“审核收件箱”，确认这条记录。

建议话术：

> 采集接口不能把 Record 直接写成已确认。确认是一个单独、追加留痕的动作；如果结论以后有误，也不会静默编辑，而是撤回或由一条新的 captured Record 取代。

## 5. 展示 Agent 接入协议（40 秒）

```bash
docker compose exec octura octura-record-prompt --json
```

输出包含版本化提示词、`octura.record.v1` 和 `octura.capture.v1` Schema。Codex、Cursor 或 Claude Code 可以通过 CLI、HTTP API 或 `octura-mcp` 调用同一套应用服务。

## 6. 收束（30 秒）

建议话术：

> Octura 1.0 刻意只做记录、查询、审核、修正和展示。单机 Docker 就能运行；所有数据保存在本地 PostgreSQL。它先把 AI 开发过程变得可追溯，再考虑协作、云同步或自动化。

## 备用命令

```bash
# 查看待审核 Record
docker compose exec octura octura-record-list --project specloop-core --status captured --json

# 查看实时服务与数据库诊断
docker compose exec octura octura-doctor --json

# 运行真实 PostgreSQL 端到端冒烟验证
docker compose exec octura node scripts/smoke.mjs

# 查看容器状态和日志
docker compose ps
docker compose logs --tail=100 octura
```
