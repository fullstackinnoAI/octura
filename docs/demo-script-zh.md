# Octura 五分钟分享脚本

## 0. 开场前准备

```bash
docker compose up --build -d
docker compose exec octura octura demo seed
docker compose exec octura octura doctor
```

浏览器打开：<http://localhost:3000/?project=octura-demo>

## 1. 问题：Git 记录结果，但没有完整的产品依据（40 秒）

建议话术：

> 当团队同时使用 Codex、Cursor 和 Claude Code 时，代码变得越来越快，但“为什么做、依据什么、是否验证过”散落在聊天、提交和人的记忆里。Octura 希望成为 AI 软件生产的事实层。

指出页面上的 Evidence timeline：Conversation、Requirement、Decision、Code、Test 串成一条时间线，而且每条记录保留来源。

## 2. 边界：Octura 不执行代码（40 秒）

建议话术：

> Octura 不做另一个 AI IDE。Agent 继续在它最擅长的工作台中执行；Octura 在执行前提供上下文，在执行后回收证据，并由人确认哪些内容可以成为产品事实。

展示右侧 Evidence chain 和 `AI can draft; humans confirm facts` 原则。

## 3. 现场从 CLI 捕获一条记录（90 秒）

在终端执行：

```bash
docker compose exec octura octura record add \
  --project octura-demo \
  --kind decision \
  --title "Keep execution outside Octura" \
  --body "Agents execute work; Octura keeps the evidence trail." \
  --source codex \
  --actor "live-demo"
```

返回内容包含 ID、Source 和 `captured` 状态。回到浏览器，等待自动刷新或点击右上角刷新按钮。

建议话术：

> 这条记录来自 Codex，但它目前只是捕获到的证据，不会自动变成可信事实。

## 4. 人工确认（50 秒）

在新记录上点击 `Review as fact`。

建议话术：

> Octura 的核心约束是：AI 可以生成草稿和记录，但 Current product truth 必须由人明确确认。这比让模型直接总结成一个漂亮页面更慢一点，却能避免它编造事实。

## 5. 收束（40 秒）

建议话术：

> 现在只是最低可用版本：CLI、PostgreSQL、Docker 和展示型 Web。下一步不是先加几十个功能，而是接入 Codex 和 GitHub，把 Requirement → Task Pack → Code/Test Evidence → Product Version 这条闭环变成团队每天自然发生的行为。

## 备用命令

列出待审核记录：

```bash
docker compose exec octura octura record list --project octura-demo --status captured
```

健康检查：

```bash
curl http://localhost:3000/health
```

查看容器：

```bash
docker compose ps
```

查看日志：

```bash
docker compose logs --tail=100 octura
```
