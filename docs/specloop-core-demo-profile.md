# SpecLoop Core 演示档案

这个档案让 Octura 直接展示当前 `specloop-core` 工作区中的真实产品事实，而不是使用虚构的示例项目。

## 生成方式

```bash
docker compose exec octura octura demo seed --profile specloop-core
```

打开：<http://localhost:3000/?project=specloop-core>

命令可重复执行；相同证据通过 idempotency key 去重。

## 证据映射

| Octura 记录 | SpecLoop Core 来源 | 说明 |
| --- | --- | --- |
| 对话 | `README.md` | 产品边界从 Agent 执行台收敛为产品事实与生产记录系统 |
| 需求 | `README.md` | 不可变修订、来源和人工确认状态 |
| 决策 | `docs/cli-first-refactor.md` | CLI-first 与统一 `ProductCore.execute()` 入口 |
| 代码 | `packages/product-core/src/service.ts` | 当前工作区中的统一命令内核实现 |
| 测试 | 本地定向测试 | Product Core 3 项、CLI 9 项，共 12 项通过 |
| 验证 | `design-qa.md` | 时间线、SPEC、控制室和工作台的历史设计 QA 证据 |
| 发布 | `docs/cli-first-refactor.md` | 第一阶段垂直链路等待演示确认 |

## 本次验证边界

2026-08-28 本地执行并通过：

```bash
pnpm --filter @specloop/product-core test
pnpm --filter @specloop/cli test
```

这里没有声称 `specloop-core` 全仓库构建、类型检查或全部测试已经通过。代码记录也明确标记为当前 working tree，而不是已发布提交。

