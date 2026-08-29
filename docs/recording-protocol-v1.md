# Octura 1.0 Agent 记录协议

Agent 在生成 Record 前运行：

```bash
octura-record-prompt --json
```

命令返回版本化提示词、`octura.record.v1` 和 `octura.capture.v1` JSON Schema。Octura 不调用模型；Agent 在自身上下文中按协议整理内容。

## 写作规则

1. 一条 Record 只描述一个连贯成果；多个无关成果拆开。
2. 标题写“对象/范围 + 动作 + 可验证结果”，不要写“任务完成”或“记录对话”。
3. `intent` 保留目标、约束和验收；`result` 说明最终状态和用户可见变化。
4. changes 定位到具体模块、文件或接口；decisions 说明选择与理由。
5. verification 只能填写真实执行结果。未运行时使用 `not_run`，不得声称 passed。
6. 不完整任务使用 `partial` 或 `blocked`，并在 risks/nextSteps 说明缺口。
7. 引用已知文件、commit、PR、issue、build 或 URL。
8. 不提交思维链、隐藏推理、密钥、个人敏感信息或大段原始日志。

## 何时使用两种采集模式

- 短任务、导入现有对话：使用 `octura-capture-add`，原子保存 Session、Messages 和 Records。
- 长任务、需要增量保留：使用 `octura-session-start`、`octura-session-append`、`octura-session-close`。
- 没有对话来源的原始事实：使用 `octura-record-add`。

正常关闭 Session 必须提交至少一条 Record；被取消的任务可以 abandon，但必须说明原因。关闭后出现的新结论应创建新 Session 或新 Record，不应改写历史。
