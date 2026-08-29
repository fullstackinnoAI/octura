# Octura × Spec Kit 兼容设计

Octura 把 Spec Kit 当作上游的规格与评估事实来源，而不是取代或修改 Spec Kit。兼容层遵循单向、只读原则：读取 Spec Kit 产物，转换为 Octura 中等待人工确认的证据记录；所有 Octura 本地状态写入独立的 `oct` 前缀命名空间。

参考：

- [Spec Kit · Assessing Ideas](https://github.com/github/spec-kit#-assessing-ideas-with-spec-kit)
- [Spec Kit assess extension](https://github.com/github/spec-kit/tree/main/extensions/assess)
- [Spec Kit feature path contract](https://github.com/github/spec-kit/blob/main/scripts/bash/common.sh)

## 所有权边界

```text
project-root/
├── .specify/                              # Spec Kit 所有；Octura 只读
│   ├── assessments/<slug>/                # Idea assessment 记录
│   └── memory/constitution.md             # 项目治理原则
├── specs/<feature>/                       # Spec Kit 所有；Octura 只读
│   ├── spec.md
│   ├── research.md
│   ├── plan.md
│   ├── data-model.md
│   ├── tasks.md
│   ├── quickstart.md
│   ├── checklists/
│   └── contracts/
└── .octura/                               # Octura 所有
    └── oct-imports/
        └── oct-spec-kit-index.json        # 导入索引，不复制或改写源文件
```

Octura 不会向 `.specify/`、`specs/` 写文件，也不会把自身文件伪装成 Spec Kit 产物。未来新增的项目内 Octura 文件必须位于 `.octura/`，文件或子目录使用 `oct-` 前缀。

## Idea assessment 映射

| Spec Kit 阶段 | 文件 | Octura `kind` | 语义 |
| --- | --- | --- | --- |
| intake | `intake.md` | `conversation` | 原始想法与上下文 |
| research | `research.md` | `verification` | 支持与反对证据 |
| define | `problem.md` | `requirement` | 问题、目标与成功指标 |
| shape | `concept.md` | `decision` | 方案与权衡 |
| decide | `decision.md` | `decision` | go / needs-clarification / kill 判断 |

Spec Kit 的 `go` 只表示评估流程的结论。导入 Octura 后仍为 `captured`，必须由人执行 `octura-record-review` 才能成为 `reviewed` 产品事实。

## Delivery artifact 映射

| Spec Kit 文件 | Octura `kind` |
| --- | --- |
| `.specify/memory/constitution.md` | `decision` |
| `spec.md` | `requirement` |
| `research.md` | `verification` |
| `plan.md`、`data-model.md` | `decision` |
| `tasks.md` | `requirement` |
| `quickstart.md` | `verification` |
| `checklists/**/*.md` | `verification` |
| `contracts/**/*.{md,json,yaml,yml,txt}` | `code` |

`.specify/feature.json` 指向的自定义 feature 目录也会被读取，但路径必须位于项目根目录内，且不能指向 `.octura/`。

## 导入协议

1. 从 `--root` 开始向上查找真实的 `.specify/` 目录。
2. 拒绝读取会越过项目根目录的路径和符号链接。
3. 发现 assessment、constitution 和 feature delivery 产物；模板、脚本和集成配置不作为产品记录导入。
4. 以 `spec-kit:<path-hash>:<content-hash>` 作为幂等键。相同内容重复导入会复用记录；源文件内容变化会新增一条记录，保留演进历史。
5. 保存完整 Markdown/文本正文，设置 `source=spec-kit`、`truth=raw`，并在 metadata 中保留相对路径、阶段、slug 和 SHA-256。
6. API 写入全部成功后，原子更新 `.octura/oct-imports/oct-spec-kit-index.json`。

## 使用方式

先预览，不写 API 或本地索引：

```bash
octura-spec-kit-import --root /path/to/project --project my-project --dry-run
```

执行导入：

```bash
OCTURA_API_URL=http://localhost:3000 \
  octura-spec-kit-import --root /path/to/project --project my-project
```

只查询导入记录：

```bash
octura-record-list --project my-project --source spec-kit
```

使用 Docker 中的 CLI 时，目标 Spec Kit 项目必须以只读 volume 挂载到容器，例如：

```bash
docker run --rm \
  -v /path/to/project:/workspace:ro \
  octura-octura:latest \
  octura-spec-kit-import --root /workspace --project my-project --dry-run
```

实际导入需要允许写入项目的 `.octura/` 索引，因此应把项目根目录作为可写 volume 挂载，或在宿主机运行 CLI。Octura 始终不会写入 `.specify/` 与 `specs/`。

## 非目标

- 不执行 Spec Kit slash command。
- 不修改、补全或覆盖 Spec Kit artifact。
- 不把 Spec Kit 的评估决定自动标为人工审核事实。
- 不要求 Spec Kit 安装 Octura extension；双向集成如有需要，应由独立 Spec Kit extension 读取 `.octura/`，而不是让 Octura 写入 `.specify/`。
