const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const state = {
  lang: localStorage.getItem("octura-language") || "zh",
  projects: [], project: null, dashboard: null, records: [], sessions: [],
  recordCursor: null, view: "overview", filters: { status: "", kind: "", q: "" }, timer: null,
};

const i18n = {
  zh: {
    workspace: "项目空间", overview: "项目概览", reviewInbox: "待审核", sessions: "原始会话", captureGuide: "采集指南",
    localFirst: "本地运行", localCopy: "数据保存在 PostgreSQL", live: "实时刷新", heroEyebrow: "AI 软件开发活动档案",
    heroMeta: "完整可见对话", structuredRecords: "结构化成果", appendOnlyReview: "追加式审核", copyPrompt: "复制提示词命令",
    openReview: "打开待审核", totalRecords: "Record 总数", recordsStored: "结构化成果记录", reviewedRecords: "已确认",
    selfAsserted: "具名、自我声明审核", pendingRecords: "待审核", needsJudgement: "等待人的判断", sessionCount: "Session",
    visibleConversations: "完整可见对话", timeline: "成果时间线", allRecords: "所有 Record", pendingTitle: "等待判断的 Record",
    searchPlaceholder: "搜索结果、决策、代码或引用", allKinds: "全部类型", allStatuses: "全部状态", loadMore: "加载更多",
    rawEvidence: "原始证据", sessionArchive: "Session 档案", agentProtocol: "Agent 记录协议", promptTitle: "先取得内置提示词与 Schema",
    promptCopy: "Octura 不调用模型；Agent 读取版本化协议后生成结构化 Record。", batchCapture: "批量原子采集",
    captureTitle: "一次保存对话与成果", copyCommand: "复制命令", privacyTitle: "记录边界",
    privacyCopy: "仅保存完整可见对话；隐藏推理、思维链、凭证和大段原始日志会被拒绝。", emptyTitle: "还没有本地项目",
    emptyCopy: "生成一套包含完整 Session、结构化 Record 和审核历史的演示档案。", createDemo: "创建演示项目",
    noRecords: "没有符合当前筛选条件的 Record。", noSessions: "还没有 Session。", confirm: "确认", dismiss: "忽略", retract: "撤回",
    reviewed: "已确认", captured: "待审核", dismissed: "已忽略", retracted: "已撤回", superseded: "已取代",
    completed: "完成", partial: "部分完成", blocked: "阻塞", source: "来源", actor: "执行者", occurred: "发生时间",
    intent: "任务意图", goal: "目标", constraints: "约束", acceptance: "验收", result: "结果", changes: "关键改动",
    decisions: "决策与取舍", verification: "验证", risks: "风险", nextSteps: "下一步", refs: "外部引用",
    provenance: "来源与归属", reviewHistory: "审核历史", selfAssertedNotice: "审核身份由调用者自我声明，Octura 未进行账号认证。",
    openSession: "查看原始 Session", messages: "条消息", resultingRecords: "成果 Record", close: "关闭", reviewerPrompt: "审核者姓名",
    notePrompt: "审核说明", operationDone: "状态已经更新", copied: "已复制", requestFailed: "请求失败", loading: "正在载入…",
    realtime: "实时", batch: "批量", open: "进行中", closed: "已关闭", abandoned: "已放弃", messageCount: "消息",
    recordCount: "Record", replacement: "替代记录", predecessor: "取代自", supersedeReason: "取代原因", details: "Record 详情",
    sessionDetail: "Session 详情", identity: "身份保证", surface: "入口", notRun: "未运行", unknown: "未知", passed: "通过", failed: "失败",
    projectSelectLabel: "选择项目", navigationLabel: "工作台导航", openNavigation: "打开导航", closeNavigation: "关闭导航",
    metricsLabel: "项目指标", kindFilterLabel: "按类型筛选", statusFilterLabel: "按状态筛选",
  },
  en: {
    workspace: "Workspace", overview: "Overview", reviewInbox: "Review inbox", sessions: "Raw sessions", captureGuide: "Capture guide",
    localFirst: "Local runtime", localCopy: "Stored in PostgreSQL", live: "Live refresh", heroEyebrow: "AI software activity archive",
    heroMeta: "Visible conversation", structuredRecords: "Structured outcomes", appendOnlyReview: "Append-only review", copyPrompt: "Copy prompt command",
    openReview: "Open review inbox", totalRecords: "Total Records", recordsStored: "Structured outcome records", reviewedRecords: "Reviewed",
    selfAsserted: "Named, self-asserted review", pendingRecords: "Awaiting review", needsJudgement: "Needs human judgment", sessionCount: "Sessions",
    visibleConversations: "Complete visible conversations", timeline: "Outcome timeline", allRecords: "All Records", pendingTitle: "Records awaiting judgment",
    searchPlaceholder: "Search results, decisions, code or refs", allKinds: "All kinds", allStatuses: "All statuses", loadMore: "Load more",
    rawEvidence: "Raw evidence", sessionArchive: "Session archive", agentProtocol: "Agent recording protocol", promptTitle: "Get the built-in prompt and Schema first",
    promptCopy: "Octura does not invoke a model. Agents read the versioned protocol and generate structured Records.", batchCapture: "Atomic batch capture",
    captureTitle: "Save conversation and outcomes together", copyCommand: "Copy command", privacyTitle: "Recording boundary",
    privacyCopy: "Only visible conversation is stored. Hidden reasoning, credentials and long raw logs are rejected.", emptyTitle: "No local project yet",
    emptyCopy: "Generate a demo with a complete Session, structured Records and review history.", createDemo: "Create demo project",
    noRecords: "No Record matches the current filters.", noSessions: "No Session yet.", confirm: "Confirm", dismiss: "Dismiss", retract: "Retract",
    reviewed: "Reviewed", captured: "Awaiting review", dismissed: "Dismissed", retracted: "Retracted", superseded: "Superseded",
    completed: "Completed", partial: "Partial", blocked: "Blocked", source: "Source", actor: "Actor", occurred: "Occurred at",
    intent: "Task intent", goal: "Goal", constraints: "Constraints", acceptance: "Acceptance", result: "Result", changes: "Key changes",
    decisions: "Decisions & trade-offs", verification: "Verification", risks: "Risks", nextSteps: "Next steps", refs: "External references",
    provenance: "Provenance & attribution", reviewHistory: "Review history", selfAssertedNotice: "Reviewer identity is self-asserted; Octura does not authenticate local accounts.",
    openSession: "Open raw Session", messages: "messages", resultingRecords: "Resulting Records", close: "Close", reviewerPrompt: "Reviewer name",
    notePrompt: "Review note", operationDone: "Record state updated", copied: "Copied", requestFailed: "Request failed", loading: "Loading…",
    realtime: "Realtime", batch: "Batch", open: "Open", closed: "Closed", abandoned: "Abandoned", messageCount: "Messages",
    recordCount: "Records", replacement: "Replacement", predecessor: "Supersedes", supersedeReason: "Supersede reason", details: "Record detail",
    sessionDetail: "Session detail", identity: "Identity assurance", surface: "Surface", notRun: "Not run", unknown: "Unknown", passed: "Passed", failed: "Failed",
    projectSelectLabel: "Select project", navigationLabel: "Workbench navigation", openNavigation: "Open navigation", closeNavigation: "Close navigation",
    metricsLabel: "Project metrics", kindFilterLabel: "Filter by kind", statusFilterLabel: "Filter by status",
  },
};

const kinds = ["summary", "requirement", "decision", "change", "test", "verification", "release"];
const statuses = ["captured", "reviewed", "dismissed", "retracted", "superseded"];
const kindNames = {
  zh: { summary: "总结", requirement: "需求", decision: "决策", change: "变更", test: "测试", verification: "人工验证", release: "发布" },
  en: { summary: "Summary", requirement: "Requirement", decision: "Decision", change: "Change", test: "Test", verification: "Verification", release: "Release" },
};

function t(key) { return i18n[state.lang][key] ?? key; }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char])); }
function date(value) { return new Intl.DateTimeFormat(state.lang === "zh" ? "zh-CN" : "en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
function truncate(value, length = 260) { return value.length > length ? `${value.slice(0, length)}…` : value; }
function list(items) { return items?.length ? `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : `<p class="empty-copy">—</p>`; }
function toast(message) { const node = $("#toast"); node.textContent = message; node.classList.add("show"); setTimeout(() => node.classList.remove("show"), 2200); }

async function api(path, init = {}) {
  const response = await fetch(path, { ...init, headers: { "Content-Type": "application/json", "X-Octura-Surface": "web", ...(init.headers || {}) } });
  const envelope = await response.json();
  if (!response.ok || !envelope.ok) throw new Error(`${envelope.error?.code || response.status}: ${envelope.error?.message || response.statusText}`);
  return envelope.data;
}

function setLanguage(lang) {
  state.lang = lang; localStorage.setItem("octura-language", lang); document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  $$('[data-lang]').forEach((button) => button.classList.toggle("active", button.dataset.lang === lang));
  $$('[data-i18n]').forEach((node) => { node.textContent = t(node.dataset.i18n); });
  $$('[data-i18n-placeholder]').forEach((node) => { node.placeholder = t(node.dataset.i18nPlaceholder); });
  $$('[data-i18n-aria-label]').forEach((node) => { node.setAttribute("aria-label", t(node.dataset.i18nAriaLabel)); });
  $("#breadcrumb").textContent = t(state.view === "review" ? "reviewInbox" : state.view === "sessions" ? "sessions" : state.view === "capture" ? "captureGuide" : "overview");
  updateMobileNavigation();
  buildFilters(); renderAll();
}

function updateMobileNavigation(open = $(".sidebar").classList.contains("open")) {
  $(".sidebar").classList.toggle("open", open);
  $("#mobile-menu").setAttribute("aria-expanded", String(open));
  $("#mobile-menu").setAttribute("aria-label", t(open ? "closeNavigation" : "openNavigation"));
}

function buildFilters() {
  const kindValue = state.filters.kind; const statusValue = state.filters.status;
  $("#kind-filter").innerHTML = `<option value="">${escapeHtml(t("allKinds"))}</option>${kinds.map((kind) => `<option value="${kind}">${escapeHtml(kindNames[state.lang][kind])}</option>`).join("")}`;
  $("#status-filter").innerHTML = `<option value="">${escapeHtml(t("allStatuses"))}</option>${statuses.map((status) => `<option value="${status}">${escapeHtml(t(status))}</option>`).join("")}`;
  $("#kind-filter").value = kindValue; $("#status-filter").value = statusValue;
}

async function loadProjects() {
  state.projects = await api("/api/v1/projects");
  if (!state.projects.length) { $("#workspace").classList.add("hidden"); $("#empty-state").classList.remove("hidden"); return; }
  $("#empty-state").classList.add("hidden"); $("#workspace").classList.remove("hidden");
  const requested = new URLSearchParams(location.search).get("project");
  state.project = state.projects.find((item) => item.slug === requested) || state.projects[0];
  $("#project-select").innerHTML = state.projects.map((item) => `<option value="${escapeHtml(item.slug)}">${escapeHtml(item.name)}</option>`).join("");
  $("#project-select").value = state.project.slug;
  await loadProject();
}

async function loadProject({ quiet = false } = {}) {
  if (!state.project) return;
  if (!quiet) $("#records-list").innerHTML = `<div class="loading">${escapeHtml(t("loading"))}</div>`;
  const query = new URLSearchParams({ limit: "50" });
  if (state.filters.status) query.set("status", state.filters.status);
  if (state.filters.kind) query.set("kind", state.filters.kind);
  if (state.filters.q) query.set("q", state.filters.q);
  const [dashboard, records, sessions] = await Promise.all([
    api(`/api/v1/projects/${encodeURIComponent(state.project.slug)}/dashboard`),
    api(`/api/v1/projects/${encodeURIComponent(state.project.slug)}/records?${query}`),
    api(`/api/v1/projects/${encodeURIComponent(state.project.slug)}/sessions?limit=50`),
  ]);
  state.dashboard = dashboard; state.records = records.items; state.recordCursor = records.nextCursor; state.sessions = sessions.items;
  const url = new URL(location.href); url.searchParams.set("project", state.project.slug); history.replaceState({}, "", url);
  renderAll();
}

function renderAll() {
  if (!state.project || !state.dashboard) return;
  $("#project-name").textContent = state.project.name; $("#project-description").textContent = state.project.description;
  const summary = state.dashboard.summary;
  $("#metric-total").textContent = summary.total; $("#metric-reviewed").textContent = summary.reviewed; $("#metric-captured").textContent = summary.captured; $("#metric-sessions").textContent = summary.sessions;
  $("#review-count").textContent = summary.captured;
  $("#capture-command").textContent = `octura-capture-add \\\n  --project ${state.project.slug} \\\n  --file capture.json`;
  renderRecords(); renderSessions();
}

function recordActions(record, detail = false) {
  if (record.status === "captured") return `<div class="record-actions"><button data-review="confirm" data-record="${record.id}">${t("confirm")}</button><button data-review="dismiss" data-record="${record.id}" class="quiet">${t("dismiss")}</button></div>`;
  if (detail && record.status === "reviewed") return `<div class="record-actions"><button data-review="retract" data-record="${record.id}" class="danger">${t("retract")}</button></div>`;
  return "";
}

function renderRecords() {
  $("#records-title").textContent = state.view === "review" ? t("pendingTitle") : t("allRecords");
  if (!state.records.length) { $("#records-list").innerHTML = `<div class="empty-list">${escapeHtml(t("noRecords"))}</div>`; }
  else $("#records-list").innerHTML = state.records.map((record) => `<article class="record-card ${record.kind}" data-card-record="${record.id}">
    <div class="record-top"><span class="kind">${escapeHtml(kindNames[state.lang][record.kind] || record.kind)}</span><time>${escapeHtml(date(record.occurredAt))}</time></div>
    <h3><button class="record-title" data-open-record="${record.id}" aria-label="${escapeHtml(`${t("details")}: ${record.title}`)}">${escapeHtml(record.title)}</button></h3><p>${escapeHtml(truncate(record.result))}</p>
    <div class="record-footer"><div class="badges"><span class="badge ${record.status}">${escapeHtml(t(record.status))}</span><span class="badge outcome">${escapeHtml(t(record.outcomeStatus))}</span><span class="badge source">${escapeHtml(record.provenance.sourceName)}</span></div>${recordActions(record)}</div>
  </article>`).join("");
  $("#load-more-records").classList.toggle("hidden", !state.recordCursor);
  bindDynamic();
}

function renderSessions() {
  if (!state.sessions.length) { $("#sessions-list").innerHTML = `<div class="empty-list">${escapeHtml(t("noSessions"))}</div>`; return; }
  $("#sessions-list").innerHTML = state.sessions.map((session) => `<button class="session-card" data-open-session="${session.id}">
    <div><span class="badge ${session.status}">${escapeHtml(t(session.status))}</span><span class="badge mode">${escapeHtml(t(session.captureMode))}</span></div>
    <h3>${escapeHtml(session.title)}</h3><p>${escapeHtml(session.sourceName)} · ${escapeHtml(session.actorName)}</p>
    <footer><span>${session.messageCount} ${escapeHtml(t("messageCount"))}</span><span>${session.recordCount} ${escapeHtml(t("recordCount"))}</span><time>${escapeHtml(date(session.startedAt))}</time></footer>
  </button>`).join("");
  bindDynamic();
}

function section(title, body, hidden = false) { return hidden ? "" : `<section class="detail-section"><h3>${escapeHtml(title)}</h3>${body}</section>`; }

async function openRecord(id) {
  const detail = await api(`/api/v1/projects/${encodeURIComponent(state.project.slug)}/records/${id}`);
  const record = detail.record;
  $("#detail-eyebrow").textContent = `${kindNames[state.lang][record.kind] || record.kind} · ${t(record.status)}`;
  $("#detail-title").textContent = record.title;
  const changes = record.changes?.map((item) => `<li><strong>${escapeHtml(item.scope)}</strong><p>${escapeHtml(item.description)}</p></li>`).join("");
  const decisions = record.decisions?.map((item) => `<li><strong>${escapeHtml(item.decision)}</strong><p>${escapeHtml(item.rationale)}</p></li>`).join("");
  const checks = record.verification?.map((item) => `<li><span class="check ${item.status}">${escapeHtml(t(item.status === "not_run" ? "notRun" : item.status))}</span><strong>${escapeHtml(item.name)}</strong>${item.details ? `<p>${escapeHtml(item.details)}</p>` : ""}${item.ref ? `<code>${escapeHtml(item.ref)}</code>` : ""}</li>`).join("");
  const refs = record.externalRefs?.map((item) => `<li><span>${escapeHtml(item.type)}</span><code>${escapeHtml(item.value)}</code></li>`).join("");
  const reviews = detail.reviews?.map((item) => `<li><div><strong>${escapeHtml(t(item.toStatus))}</strong><span>${escapeHtml(item.reviewer)} · ${escapeHtml(item.surface)} · ${escapeHtml(date(item.createdAt))}</span></div><p>${escapeHtml(item.note)}</p></li>`).join("");
  $("#detail-content").innerHTML = `<div class="detail-summary"><div class="badges"><span class="badge ${record.status}">${escapeHtml(t(record.status))}</span><span class="badge outcome">${escapeHtml(t(record.outcomeStatus))}</span></div>${recordActions(record, true)}</div>
    ${section(t("intent"), `<dl><dt>${t("goal")}</dt><dd>${escapeHtml(record.intent.goal)}</dd><dt>${t("constraints")}</dt><dd>${list(record.intent.constraints)}</dd><dt>${t("acceptance")}</dt><dd>${list(record.intent.acceptance)}</dd></dl>`)}
    ${section(t("result"), `<div class="markdown">${escapeHtml(record.result)}</div>`)}
    ${section(t("changes"), `<ul class="rich-list">${changes}</ul>`, !changes)}
    ${section(t("decisions"), `<ul class="rich-list">${decisions}</ul>`, !decisions)}
    ${section(t("verification"), `<ul class="verification-list">${checks}</ul>`, !checks)}
    <div class="detail-columns">${section(t("risks"), list(record.risks))}${section(t("nextSteps"), list(record.nextSteps))}</div>
    ${section(t("refs"), `<ul class="ref-list">${refs || "<li>—</li>"}</ul>`)}
    ${section(t("provenance"), `<dl class="provenance"><dt>${t("source")}</dt><dd>${escapeHtml(record.provenance.sourceType)} / ${escapeHtml(record.provenance.sourceName)}</dd><dt>${t("actor")}</dt><dd>${escapeHtml(record.provenance.actorType)} / ${escapeHtml(record.provenance.actorName)}</dd><dt>Truth</dt><dd>${escapeHtml(record.provenance.truth)}</dd><dt>${t("occurred")}</dt><dd>${escapeHtml(date(record.occurredAt))}</dd></dl>`)}
    ${record.sourceSessionId ? `<button class="linked-session" data-open-session="${record.sourceSessionId}">${escapeHtml(t("openSession"))} →</button>` : ""}
    ${detail.supersession ? section(t("replacement"), `<button class="text-link" data-open-record="${detail.supersession.replacementId}">${escapeHtml(detail.supersession.reason)} →</button>`) : ""}
    ${detail.supersededBy ? section(t("predecessor"), `<button class="text-link" data-open-record="${detail.supersededBy.predecessorId}">${escapeHtml(detail.supersededBy.reason)} →</button>`) : ""}
    ${section(t("reviewHistory"), `<p class="assurance">${escapeHtml(t("selfAssertedNotice"))}</p><ol class="review-list">${reviews || "<li>—</li>"}</ol>`)}
  `;
  $("#detail-dialog").showModal(); bindDynamic();
}

async function openSession(id) {
  const detail = await api(`/api/v1/projects/${encodeURIComponent(state.project.slug)}/sessions/${id}`);
  const session = detail.session;
  $("#detail-eyebrow").textContent = `${t("sessionDetail")} · ${t(session.status)}`; $("#detail-title").textContent = session.title;
  const messages = detail.messages.map((message) => `<article class="message ${message.role}"><header><strong>${escapeHtml(message.role)}</strong><span>${escapeHtml(message.actorName || "—")} · #${message.sequence} · ${escapeHtml(date(message.occurredAt))}</span></header><div>${escapeHtml(message.content)}</div></article>`).join("");
  const records = detail.records.map((record) => `<button class="linked-record" data-open-record="${record.id}"><span class="badge ${record.status}">${escapeHtml(t(record.status))}</span><strong>${escapeHtml(record.title)}</strong></button>`).join("");
  $("#detail-content").innerHTML = `${section(t("provenance"), `<dl class="provenance"><dt>${t("source")}</dt><dd>${escapeHtml(session.sourceType)} / ${escapeHtml(session.sourceName)}</dd><dt>${t("actor")}</dt><dd>${escapeHtml(session.actorType)} / ${escapeHtml(session.actorName)}</dd><dt>Mode</dt><dd>${escapeHtml(t(session.captureMode))}</dd><dt>${t("occurred")}</dt><dd>${escapeHtml(date(session.startedAt))}</dd></dl>`)}
    ${section(`${detail.messages.length} ${t("messages")}`, `<div class="messages">${messages}</div>`)}
    ${section(t("resultingRecords"), `<div class="linked-records">${records || "—"}</div>`)}`;
  $("#detail-dialog").showModal(); bindDynamic();
}

async function review(action, id) {
  const reviewer = window.prompt(t("reviewerPrompt"), localStorage.getItem("octura-reviewer") || "local-reviewer"); if (!reviewer) return;
  const note = window.prompt(t("notePrompt"), action === "confirm" ? "已核对原始 Session、来源和成果内容" : "记录判断与原因"); if (!note) return;
  localStorage.setItem("octura-reviewer", reviewer);
  await api(`/api/v1/projects/${encodeURIComponent(state.project.slug)}/records/${id}/reviews`, { method: "POST", body: JSON.stringify({ action, reviewer, attestation: "human_reviewed", note, idempotencyKey: `web:${action}:${id}:${crypto.randomUUID()}` }) });
  $("#detail-dialog").close(); toast(t("operationDone")); await loadProject({ quiet: true });
}

function bindDynamic() {
  $$('[data-card-record]').forEach((node) => { node.onclick = (event) => { if (event.target.closest("button")) return; void openRecord(node.dataset.cardRecord).catch(showError); }; });
  $$('[data-open-record]').forEach((node) => {
    node.onclick = (event) => { if (event.target.closest("[data-review]")) return; void openRecord(node.dataset.openRecord).catch(showError); };
    node.onkeydown = (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); void openRecord(node.dataset.openRecord).catch(showError); } };
  });
  $$('[data-open-session]').forEach((node) => { node.onclick = () => void openSession(node.dataset.openSession).catch(showError); });
  $$('[data-review]').forEach((node) => { node.onclick = (event) => { event.stopPropagation(); void review(node.dataset.review, node.dataset.record).catch(showError); }; });
}

function showView(view, updateHash = true) {
  state.view = view; $$('.nav-item').forEach((item) => item.classList.toggle("active", item.dataset.view === view));
  const records = view === "overview" || view === "review";
  $("#hero").classList.toggle("hidden", view !== "overview"); $(".metrics").classList.toggle("hidden", view !== "overview");
  $("#records-view").classList.toggle("hidden", !records); $("#sessions-view").classList.toggle("hidden", view !== "sessions"); $("#capture-view").classList.toggle("hidden", view !== "capture");
  state.filters.status = view === "review" ? "captured" : ""; $("#status-filter").value = state.filters.status;
  $("#breadcrumb").textContent = t(view === "review" ? "reviewInbox" : view === "sessions" ? "sessions" : view === "capture" ? "captureGuide" : "overview");
  if (updateHash) history.replaceState({}, "", `${location.pathname}${location.search}#${view}`);
  if (state.project && records) void loadProject({ quiet: true }).catch(showError);
}

function showError(error) { console.error(error); toast(`${t("requestFailed")}: ${error.message}`); }

let searchTimer;
function bindStatic() {
  $$('[data-lang]').forEach((button) => button.addEventListener("click", () => setLanguage(button.dataset.lang)));
  $$('.nav-item').forEach((button) => button.addEventListener("click", () => showView(button.dataset.view)));
  $$('[data-view-link]').forEach((button) => button.addEventListener("click", () => showView(button.dataset.viewLink)));
  $("#project-select").addEventListener("change", async (event) => { state.project = state.projects.find((item) => item.slug === event.target.value); await loadProject(); });
  $("#mobile-menu").addEventListener("click", () => updateMobileNavigation(!$(".sidebar").classList.contains("open")));
  $$('.nav-item').forEach((button) => button.addEventListener("click", () => updateMobileNavigation(false)));
  $("#kind-filter").addEventListener("change", (event) => { state.filters.kind = event.target.value; void loadProject().catch(showError); });
  $("#status-filter").addEventListener("change", (event) => { state.filters.status = event.target.value; void loadProject().catch(showError); });
  $("#search-input").addEventListener("input", (event) => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { state.filters.q = event.target.value.trim(); void loadProject().catch(showError); }, 280); });
  $("#close-detail").addEventListener("click", () => $("#detail-dialog").close());
  $("#detail-dialog").addEventListener("click", (event) => { if (event.target === $("#detail-dialog")) $("#detail-dialog").close(); });
  $("#copy-prompt").addEventListener("click", () => navigator.clipboard.writeText("octura-record-prompt --json").then(() => toast(t("copied"))));
  $("#copy-capture").addEventListener("click", () => navigator.clipboard.writeText($("#capture-command").textContent).then(() => toast(t("copied"))));
  $("#seed-demo").addEventListener("click", async () => { await api("/api/v1/demo/seed", { method: "POST", body: JSON.stringify({ profile: "octura" }) }); await loadProjects(); });
  $("#load-more-records").addEventListener("click", async () => {
    if (!state.recordCursor) return; const query = new URLSearchParams({ limit: "50", cursor: state.recordCursor });
    if (state.filters.status) query.set("status", state.filters.status); if (state.filters.kind) query.set("kind", state.filters.kind); if (state.filters.q) query.set("q", state.filters.q);
    const result = await api(`/api/v1/projects/${encodeURIComponent(state.project.slug)}/records?${query}`); state.records.push(...result.items); state.recordCursor = result.nextCursor; renderRecords();
  });
}

bindStatic(); buildFilters(); setLanguage(state.lang);
const initialView = ["overview", "review", "sessions", "capture"].includes(location.hash.slice(1)) ? location.hash.slice(1) : "overview";
showView(initialView, false);
loadProjects().catch(showError);
state.timer = setInterval(() => { if (state.project && !document.hidden && !$("#detail-dialog").open) void loadProject({ quiet: true }).catch(() => undefined); }, 6000);
