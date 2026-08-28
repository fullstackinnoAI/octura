# Octura 设计 QA

## 验证目标

- 设计要求：保留紫橙配色、深紫导航、浅紫画布、柔和卡片与审核状态层级；移除外部品牌署名、IP 形象和品牌专属图标。
- 视觉参考：`docs/design-assets/octura-fullstack-cn-viewport.png`
- 实现截图：`docs/design-assets/octura-purple-orange-no-brand.png`
- 全视图对照：`docs/design-assets/octura-no-brand-comparison.png`
- 重点区域对照：`docs/design-assets/octura-no-brand-comparison-focus.png`
- 页面：`http://localhost:3000/?project=octura-demo`

## 画面与归一化

- 参考截图：1280 × 720 像素，CSS 视口 1280 × 720，deviceScaleFactor 1。
- 实现截图：1029 × 747 像素，CSS 视口 1029 × 747，deviceScaleFactor 1。
- 全视图对照画布：1029 × 747；两张截图等宽适配各自对照面板。
- 重点区域对照：参考截图按 0.474 倍、实现截图按 0.598 倍缩放，统一展示主内容区的 Hero、指标卡与时间线起始区域。
- 两张截图的记录状态不同：参考为 4 条已审核、2 条待确认；实现为当前数据库状态 6 条已审核、0 条待确认。对照只判断视觉结构和品牌露出，不把数值差异视为设计偏差。

## 五项视觉检查

- 字体与层级：保留 PingFang SC / Microsoft YaHei 中文字体栈；标题、指标、标签、正文和辅助信息层级清楚，无异常换行或截断。
- 间距与布局：侧栏、Hero、指标卡、时间线与检查面板保持原有栅格关系；1029 × 747 当前视口无横向溢出、遮挡或控件裁切。
- 色彩与视觉令牌：深紫、品牌紫、薰衣草紫、橙色强调和浅紫画布保持一致；状态色、边框、阴影和圆角仍构成统一视觉语言。
- 图片与资产：实现页面不再依赖或展示外部品牌图片；署名、章鱼 IP、专属背景与 3D 图标全部从可见界面移除。
- 文案与内容：页面只呈现 Octura 产品名、功能、数据和中文操作信息；DOM 中“全栈创新”“章鱼”相关可见文本均为 0。

## 交互验证

- 项目选择器正常加载当前项目。
- “全部 / 待审核 / 已审核”筛选正常；当前没有待审核记录时能显示正确空状态。
- 刷新和自动同步正常。
- 产品页面控制台 error / warning：0。
- `node --check public/app.js`、`pnpm typecheck`、`pnpm test`、`pnpm build` 全部通过。

## 对照结论

- 全视图：紫橙色板、信息密度与卡片层级完整保留，外部品牌署名和 IP 视觉已退出。
- 重点区域：视觉注意力从 IP 与专属图标回到 Octura 名称、证据数据和“审核证据”主动作。
- P0：0
- P1：0
- P2：0
- P3：可选后续优化为 Octura 设计一套独立图标系统；当前无图标版本更克制，不影响可用性。
- QA 迭代历史：本轮首次对照未发现可执行的 P0/P1/P2 问题，因此无需阻断式修复循环。

final result: passed
