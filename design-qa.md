# Octura 设计 QA

## 验证目标

- 设计要求：在现有 Octura 紫橙工作台中增加中文 / English 即时切换，不破坏布局、交互和证据原文。
- 视觉基准：`docs/design-assets/octura-purple-orange-no-brand.png`
- 中文实现：`docs/design-assets/octura-bilingual-zh.png`
- 英文实现：`docs/design-assets/octura-bilingual-en.png`
- 全视图对照：`docs/design-assets/octura-bilingual-comparison.png`
- 重点区域对照：`docs/design-assets/octura-bilingual-comparison-focus.png`
- 页面：`http://localhost:3000/?project=octura-demo`

## 画面与归一化

- 基准、中文实现和英文实现均为 1029 × 747 像素。
- CSS 视口：1029 × 747；deviceScaleFactor：1。
- 数据状态一致：`octura-demo`，6 条记录，6 条已审核，0 条待确认。
- 全视图对照将中文与英文截图等宽排列；重点区域使用相同比例裁切语言开关、Hero、指标与筛选区域。

## 五项视觉检查

- 字体与层级：中文使用 PingFang SC / Microsoft YaHei 字体栈，英文使用相同 UI 字体体系；标题、按钮、辅助文案和指标层级一致。
- 间距与布局：英文长标签未造成导航、Hero 主按钮、指标卡或筛选器挤压、截断和换行；当前视口无横向溢出。
- 色彩与视觉令牌：语言开关沿用现有紫色边框、浅紫背景与白色选中态，没有引入新的视觉风格。
- 图片与资产：页面不依赖图片资产，语言功能没有重新引入外部品牌露出或占位图形。
- 文案与内容：系统 UI、状态、时间、CLI 引导、Toast 与空状态均可切换；项目名称、描述、证据标题和正文保持采集时的原始语言。

## 交互验证

- 点击 `EN` 后，导航、指标、状态、筛选、时间、证据类型和 CLI 文案即时切换为英文。
- 刷新页面后英文选择保持，证明 `localStorage` 持久化正常。
- 英文 `Pending` 筛选能显示正确的英文空状态。
- 切回中文后界面立即恢复，并在再次刷新后继续保持中文。
- 页面最终恢复为中文与“全部”筛选状态。
- 产品页面控制台 error / warning：0。
- `node --check public/app.js`、`pnpm typecheck`、`pnpm test`、`pnpm build` 全部通过。

## 对照结论

- 全视图：中英文版本保持相同的信息架构、视觉密度和主操作层级。
- 重点区域：语言开关识别清楚；英文长文案没有改变 Hero 与指标卡的主要比例。
- P0：0
- P1：0
- P2：0
- P3：项目与证据内容遵循“原文保真”策略，因此英文界面中可能出现中文事实记录，这是预期行为。
- QA 迭代历史：首次对照未发现可执行的 P0/P1/P2 问题，无需阻断式修复循环。

final result: passed
