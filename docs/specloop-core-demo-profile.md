# `specloop-core` 真实项目演示档案

这个档案把 SpecLoop Core 收敛为 Octura 1.0 的过程保存成一段完整 Session 和六条结构化成果，用于演示“详细记录与展示”，不再沿用旧版固定证据分类或覆盖率。

## 生成方式

```bash
docker compose exec octura octura-demo-seed --profile specloop-core --json
```

打开 <http://localhost:3000/?project=specloop-core>。命令可重复执行；相同幂等键和相同内容返回首次结果，不会重复写入。

## 演示数据

Session：`SpecLoop Core → Octura 1.0 产品收敛`

- 四条完整可见消息：user、assistant、tool、assistant；
- 六条 Record：summary、requirement、decision、change、test、verification；
- 前四条经过单独的 `confirm` 审核，后两条保留为待审核；
- 来源覆盖 human、Codex Agent 和 CI；
- 文件引用指向 1.0 产品 SPEC 或统一应用服务。

| Record | 事实来源 | 初始状态 | 演示重点 |
| --- | --- | --- | --- |
| 确认 SpecLoop 重构为 Octura | Codex 派生 | reviewed | 产品边界收敛 |
| 完整保存可见对话与成果记录 | 人工原始说明 | reviewed | Session 与 Record 双层记录 |
| 采用批量与实时双轨采集 | Codex 派生 | reviewed | 原子 Capture 与顺序追加 |
| 统一记录内核已经形成 | Codex 派生 | reviewed | CLI/API/MCP 共享规则 |
| 记录契约与状态机验证通过 | CI 原始结果 | captured | 不能由采集接口直接确认 |
| 1.0 工作台等待最终人工确认 | Codex 派生 | captured | 风险、下一步与审核声明 |

## 真实性边界

- 演示档案是为当前 1.0 实现生成的确定性种子，不声称已经迁移旧 SpecLoop 数据库。
- `derived` 表示 Agent 根据 Session 形成的结构化成果；`raw` 表示直接保存的人工说明或 CI 验证摘要。
- 演示确认事件使用本地调用者声明 `woo`，没有账号认证，Web 会明确展示这一限制。
- `tool` 消息只保存简短验证摘要，不保存隐藏推理、密钥或大段原始终端日志。
