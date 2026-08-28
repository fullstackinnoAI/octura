# Octura

**Evidence OS for AI software delivery.**

Octura 把 AI 辅助开发过程中的意图、需求、决策、代码引用、测试和人工验证保存为一条可审核的产品事实链。

它不执行代码，也不替代 Codex、Cursor、Claude Code、GitHub 或 CI。它负责回答：

- 为什么要做这次变更？
- AI 和人分别做了什么？
- 证据来自哪里？
- 哪些内容已经由人确认？

## 60 秒启动

需要 Docker Desktop 或兼容的 Docker Engine。

```bash
docker compose up --build -d
docker compose exec octura octura demo seed
```

打开 [http://localhost:3000](http://localhost:3000)。

检查环境：

```bash
docker compose exec octura octura doctor
```

停止服务：

```bash
docker compose down
```

数据保存在名为 `octura_data` 的 Docker volume 中，普通的 `docker compose down` 不会删除数据。

## 现场演示

先打开 Web 工作台，然后在另一个终端执行：

```bash
docker compose exec octura octura record add \
  --project octura-demo \
  --kind decision \
  --title "Use evidence as the product boundary" \
  --body "Octura records facts while external agents execute the work." \
  --source codex \
  --actor "live-demo"
```

新记录会在 6 秒内自动出现在 Web 时间线上，并标记为 `Needs review`。可以在页面点击 `Review as fact`，也可以从 CLI 审核：

```bash
docker compose exec octura octura record list --project octura-demo --status captured
docker compose exec octura octura record review --project octura-demo --id <record-id> --note "Confirmed during the live demo"
```

更完整的话术见 [中文演示脚本](docs/demo-script-zh.md)。

## CLI

```text
octura doctor
octura demo seed [--project <slug>]

octura project create --slug <slug> --name <name>
octura project list

octura record add --project <slug> --kind <kind> --title <title> --body <body>
octura record list --project <slug> [--status captured|reviewed]
octura record review --project <slug> --id <id> [--note <note>]
```

支持的记录类型：

```text
conversation / requirement / decision / code / test / verification / release
```

支持的来源：

```text
human / codex / cursor / claude / git / ci / api / other
```

所有命令都可以增加 `--json`，用于 Agent、脚本和其他工具集成。

## 本地开发

需要 Node.js 20+、pnpm 9+ 和一个 PostgreSQL 数据库。

```bash
pnpm install
cp .env.example .env
pnpm dev
```

另一个终端中：

```bash
pnpm cli -- doctor
pnpm cli -- demo seed
```

质量检查：

```bash
pnpm typecheck
pnpm test
pnpm build
```

## 最小架构

```text
Octura CLI ─┐
            ├── HTTP API ── Product contracts ── PostgreSQL
Web UI ─────┘                                  └── immutable evidence trail
```

- CLI 是 AI 工具和自动化的接入表面。
- API 提供稳定的 `octura.api.v1` JSON envelope。
- PostgreSQL 保存来源、actor、raw/derived 和审核状态。
- Web 以展示、追踪和人工确认事实为主。

## 当前范围

这是为产品分享准备的 Developer Preview，已覆盖最小证据闭环。暂未实现：

- 登录、多租户和远端同步；
- GitHub/Codex 自动导入；
- Product Version Manifest；
- 云端部署与计费。

这些能力应在设计伙伴验证当前闭环后继续建设。
