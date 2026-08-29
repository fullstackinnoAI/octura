# Changelog

## 1.0.0-rc.1

- 新增完整可见 Session、顺序消息与批量/实时双轨采集。
- 将扁平证据升级为 `octura.record.v1` 结构化成果契约。
- 新增追加式审核、撤回、忽略和 Record 取代关系。
- 新增版本化提示词命令、独立 CLI、HTTP `/api/v1` 与 MCP stdio。
- 重做工作台，提供搜索时间线、审核收件箱、Record 与 Session 详情。
- 移除推断式五类覆盖率；概览只显示真实记录、审核和 Session 数量。

## 0.1.0 — Developer Preview

- Added a local-first PostgreSQL evidence store.
- Added project and evidence-record HTTP APIs with the `octura.api.v1` envelope.
- Added the `octura` CLI for project creation, capture, listing, review and demo seeding.
- Added a display-oriented evidence workspace with live refresh and human review.
- Added a one-command Docker Compose environment and five-minute demo script.
