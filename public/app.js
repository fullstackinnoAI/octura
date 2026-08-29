const state = {
  projects: [],
  dashboard: null,
  filter: "all",
  loading: false,
  locale: localStorage.getItem("octura.locale") === "en" ? "en" : "zh",
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const translations = {
  zh: {
    pageTitle: "Octura · 产品事实工作台",
    brandSubtitle: "产品事实工作台",
    currentProject: "当前项目",
    workspaceGroup: "事实工作台",
    overview: "项目概览",
    evidenceRecords: "证据记录",
    productVersions: "产品版本",
    soon: "即将开放",
    connectGroup: "连接与采集",
    cliCapture: "CLI 采集",
    integrations: "外部集成",
    localSecure: "本地安全运行",
    localDescription: "全部产品证据保存在当前 Docker 环境中。",
    buildLabel: "Octura · 开发预览版 0.1.0",
    sync: "实时同步",
    syncing: "同步中…",
    refresh: "刷新",
    refreshData: "刷新数据",
    cliGuide: "CLI 指南",
    truthLayer: "AI 软件生产的可信事实层",
    emptyTitle: "让每一次 AI 交付都有依据。",
    emptyDescription: "写入演示数据，或从 Octura CLI 创建项目，体验完整的本地证据闭环。",
    seedDemo: "载入中文演示数据",
    heroKicker: "AI 软件交付的可信事实层",
    heroMeta: "本地优先 · 开放采集 · 人工确认",
    copyCapture: "复制采集命令",
    reviewEvidence: "审核证据",
    humanReviewed: "人工已审核",
    awaitingReview: "等待确认",
    awaitingNote: "需要人的判断与确认",
    coverage: "证据链覆盖率",
    timeline: "证据时间线",
    timelineTitle: "产品事实是如何形成的",
    all: "全部",
    pending: "待审核",
    reviewed: "已审核",
    trustCheck: "可信度检查",
    chainIntegrity: "证据链完整性",
    chainDescription: "可信交付必须连接用户意图、产品约束、关键决策、代码实现和验证结果。",
    principle: "AI 负责提案，人类负责事实与判断。只有经过审核的证据，才能成为产品事实。",
    captureFromAgent: "从任意 Agent 采集",
    autoTimeline: "写入后自动出现在时间线",
    copy: "复制",
    copyCommand: "复制命令",
    projectFallback: "一条可追溯、可验证的 AI 产品交付证据链。",
    sourcesNote: "来自 {count} 个可信来源",
    reviewedNote: "{percent}% 的记录已成为可信事实",
    noReviewedNote: "等待建立可信事实",
    healthComplete: "完整",
    healthBuilding: "正在构建",
    captureTitle: "保留交付证据",
    captureBody: "关键事实需要人工确认",
    recordCount: "{count} 条记录",
    missing: "缺失",
    noEvidence: "没有符合当前筛选条件的证据。",
    reviewedStatus: "人工已审核",
    capturedStatus: "等待审核",
    rawTruth: "原始证据",
    derivedTruth: "派生内容",
    reviewing: "正在确认…",
    reviewAsFact: "确认为事实",
    acceptedToast: "证据已确认为产品事实",
    captureCopied: "采集命令已复制",
    seeding: "正在生成演示数据…",
    demoReady: "中文演示数据已就绪",
    newEvidence: "已采集新的产品证据",
    databaseWaiting: "Octura 正在等待数据库连接。",
    requestFailed: "请求失败（{status}）",
    justNow: "刚刚",
    minutesAgo: "{count} 分钟前",
    hoursAgo: "{count} 小时前",
    daysAgo: "{count} 天前",
    passed: "通过",
    failed: "失败",
    emptyCommandName: "我的项目",
    filterAria: "筛选证据",
    metricsAria: "项目指标",
    navAria: "主要导航",
    selectProjectAria: "选择项目",
    openNavAria: "打开导航",
    reviewNote: "已在 Octura 证据工作台中确认",
    kinds: { conversation: "对话记录", requirement: "产品需求", decision: "关键决策", code: "代码变更", test: "测试结果", verification: "人工验证", release: "发布事实" },
    sources: { human: "人工", codex: "Codex", cursor: "Cursor", claude: "Claude", git: "Git", ci: "CI", api: "API", "spec-kit": "Spec Kit", other: "其他" },
  },
  en: {
    pageTitle: "Octura · Product truth workspace",
    brandSubtitle: "Product truth workspace",
    currentProject: "Current project",
    workspaceGroup: "Truth workspace",
    overview: "Overview",
    evidenceRecords: "Evidence records",
    productVersions: "Product versions",
    soon: "Soon",
    connectGroup: "Connect & capture",
    cliCapture: "CLI capture",
    integrations: "Integrations",
    localSecure: "Secure local runtime",
    localDescription: "All product evidence stays in this Docker environment.",
    buildLabel: "Octura · Developer Preview 0.1.0",
    sync: "Live sync",
    syncing: "Syncing…",
    refresh: "Refresh",
    refreshData: "Refresh data",
    cliGuide: "CLI guide",
    truthLayer: "The truth layer for AI software delivery",
    emptyTitle: "Give every AI delivery a traceable basis.",
    emptyDescription: "Seed the demo or create a project with the Octura CLI to experience the complete local evidence loop.",
    seedDemo: "Load demo data",
    heroKicker: "The truth layer for AI software delivery",
    heroMeta: "Local-first · Open capture · Human confirmation",
    copyCapture: "Copy capture command",
    reviewEvidence: "Review evidence",
    humanReviewed: "Human reviewed",
    awaitingReview: "Awaiting review",
    awaitingNote: "Requires human judgment and confirmation",
    coverage: "Evidence-chain coverage",
    timeline: "Evidence timeline",
    timelineTitle: "How product truth is formed",
    all: "All",
    pending: "Pending",
    reviewed: "Reviewed",
    trustCheck: "Trust check",
    chainIntegrity: "Evidence-chain integrity",
    chainDescription: "Trusted delivery connects user intent, product constraints, key decisions, code implementation, and verification results.",
    principle: "AI proposes; people own facts and judgment. Evidence becomes product truth only after review.",
    captureFromAgent: "Capture from any agent",
    autoTimeline: "Appears in the timeline after capture",
    copy: "Copy",
    copyCommand: "Copy command",
    projectFallback: "A traceable and verifiable evidence chain for AI product delivery.",
    sourcesNote: "From {count} trusted sources",
    reviewedNote: "{percent}% of records are trusted product facts",
    noReviewedNote: "No trusted product facts yet",
    healthComplete: "Complete",
    healthBuilding: "Building",
    captureTitle: "Preserve delivery evidence",
    captureBody: "Critical facts require human confirmation",
    recordCount: "{count} record(s)",
    missing: "Missing",
    noEvidence: "No evidence matches this filter.",
    reviewedStatus: "Human reviewed",
    capturedStatus: "Needs review",
    rawTruth: "Raw evidence",
    derivedTruth: "Derived content",
    reviewing: "Reviewing…",
    reviewAsFact: "Confirm as fact",
    acceptedToast: "Evidence accepted as product truth",
    captureCopied: "Capture command copied",
    seeding: "Loading demo data…",
    demoReady: "Demo data is ready",
    newEvidence: "New evidence captured",
    databaseWaiting: "Octura is waiting for its database connection.",
    requestFailed: "Request failed ({status})",
    justNow: "Just now",
    minutesAgo: "{count}m ago",
    hoursAgo: "{count}h ago",
    daysAgo: "{count}d ago",
    passed: "Passed",
    failed: "Failed",
    emptyCommandName: "My Project",
    filterAria: "Filter evidence",
    metricsAria: "Project metrics",
    navAria: "Primary navigation",
    selectProjectAria: "Select project",
    openNavAria: "Open navigation",
    reviewNote: "Confirmed in the Octura evidence workspace",
    kinds: { conversation: "Conversation", requirement: "Requirement", decision: "Decision", code: "Code change", test: "Test result", verification: "Verification", release: "Release fact" },
    sources: { human: "Human", codex: "Codex", cursor: "Cursor", claude: "Claude", git: "Git", ci: "CI", api: "API", "spec-kit": "Spec Kit", other: "Other" },
  },
};

function t(key, values = {}) {
  const template = translations[state.locale][key] ?? translations.zh[key] ?? key;
  if (typeof template !== "string") return template;
  return Object.entries(values).reduce((result, [name, value]) => result.replaceAll(`{${name}}`, String(value)), template);
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function relativeTime(value) {
  const seconds = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return t("justNow");
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return t("minutesAgo", { count: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return t("hoursAgo", { count: hours });
  const days = Math.round(hours / 24);
  return t("daysAgo", { count: days });
}

function formatKind(kind) {
  return translations[state.locale].kinds[kind] ?? kind;
}

function formatSource(source) {
  return translations[state.locale].sources[source] ?? source;
}

function formatTruth(truth) {
  return truth === "derived" ? t("derivedTruth") : t("rawTruth");
}

function formatVerdict(verdict) {
  if (verdict === "passed") return t("passed");
  if (verdict === "failed") return t("failed");
  return verdict;
}

async function api(path, options) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error?.message ?? t("requestFailed", { status: response.status }));
  return payload.data;
}

let toastTimer;
function toast(message) {
  const element = $("#toast");
  element.textContent = message;
  element.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove("show"), 2200);
}

function setLive(loading) {
  state.loading = loading;
  $("#sync-status").innerHTML = loading ? t("syncing") : `<span class="pulse"></span>${t("sync")}`;
  $("#refresh-button").disabled = loading;
}

function applyLocale() {
  document.documentElement.lang = state.locale === "zh" ? "zh-CN" : "en";
  document.title = t("pageTitle");

  $$('[data-i18n]').forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  $$('[data-i18n-title]').forEach((element) => {
    element.title = t(element.dataset.i18nTitle);
  });
  $$('[data-i18n-aria]').forEach((element) => {
    element.setAttribute("aria-label", t(element.dataset.i18nAria));
  });

  $(".nav")?.setAttribute("aria-label", t("navAria"));
  $("#project-select")?.setAttribute("aria-label", t("selectProjectAria"));
  $(".mobile-brand")?.setAttribute("aria-label", t("openNavAria"));
  $(".metrics")?.setAttribute("aria-label", t("metricsAria"));
  $(".filter-group")?.setAttribute("aria-label", t("filterAria"));
  $("#empty-command").textContent = `octura-project-create --slug my-project --name "${t("emptyCommandName")}"`;

  $$('[data-locale]').forEach((button) => {
    const active = button.dataset.locale === state.locale;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  setLive(state.loading);
  if (state.dashboard) renderDashboard();
}

async function loadProjects(preferredSlug) {
  state.projects = await api("/api/projects");
  const select = $("#project-select");
  select.innerHTML = state.projects
    .map((project) => `<option value="${escapeHtml(project.slug)}">${escapeHtml(project.name)}</option>`)
    .join("");

  if (!state.projects.length) {
    $("#dashboard").classList.add("hidden");
    $("#empty-state").classList.remove("hidden");
    return;
  }

  const selected = state.projects.find((item) => item.slug === preferredSlug) ?? state.projects[0];
  select.value = selected.slug;
  $("#empty-state").classList.add("hidden");
  $("#dashboard").classList.remove("hidden");
  await loadDashboard(selected.slug);
}

async function loadDashboard(slug, quiet = false) {
  if (state.loading) return;
  setLive(true);
  try {
    const previousTotal = state.dashboard?.summary?.total;
    state.dashboard = await api(`/api/projects/${encodeURIComponent(slug)}/dashboard`);
    renderDashboard();
    const url = new URL(window.location.href);
    url.searchParams.set("project", slug);
    history.replaceState({}, "", url);
    localStorage.setItem("octura.project", slug);
    if (quiet && previousTotal !== undefined && state.dashboard.summary.total > previousTotal) {
      toast(t("newEvidence"));
    }
  } catch (error) {
    if (!quiet) toast(error.message);
  } finally {
    setLive(false);
  }
}

function renderDashboard() {
  const { project, summary } = state.dashboard;
  $("#project-name").textContent = project.name;
  $("#project-description").textContent = project.description || t("projectFallback");
  $("#breadcrumb-project").textContent = project.name;
  $("#nav-count").textContent = summary.total;
  $("#metric-total").textContent = summary.total;
  $("#metric-sources-note").textContent = t("sourcesNote", { count: summary.sources });
  $("#metric-reviewed").textContent = summary.reviewed;
  $("#metric-captured").textContent = summary.captured;
  $("#metric-reviewed-note").textContent = summary.total
    ? t("reviewedNote", { percent: Math.round((summary.reviewed / summary.total) * 100) })
    : t("noReviewedNote");
  $("#metric-coverage").textContent = summary.coverage;
  $("#metric-coverage-bar").style.width = `${summary.coverage}%`;
  $("#health-badge").textContent = summary.coverage === 100 ? t("healthComplete") : t("healthBuilding");

  const command = `octura-record-add \\\n  --project ${project.slug} \\\n  --kind decision \\\n  --title "${t("captureTitle")}" \\\n  --body "${t("captureBody")}" \\\n  --source codex`;
  $("#capture-command").textContent = command;

  renderEvidenceChain();
  renderTimeline();
}

function renderEvidenceChain() {
  const counts = Object.fromEntries(state.dashboard.summary.kinds.map((item) => [item.kind, item.count]));
  $("#evidence-chain").innerHTML = state.dashboard.summary.requiredKinds
    .map((kind) => {
      const count = counts[kind] ?? 0;
      return `<div class="chain-row ${count ? "present" : ""}">
        <span class="chain-name">${escapeHtml(formatKind(kind))}</span>
        <span class="chain-count">${count ? escapeHtml(t("recordCount", { count })) : escapeHtml(t("missing"))}</span>
      </div>`;
    })
    .join("");
}

function renderTimeline() {
  const records = state.dashboard.records.filter((record) => state.filter === "all" || record.status === state.filter);
  if (!records.length) {
    $("#timeline").innerHTML = `<div class="empty-filter">${escapeHtml(t("noEvidence"))}</div>`;
    return;
  }

  $("#timeline").innerHTML = records
    .map((record) => {
      const metadataVerdict = record.metadata?.verdict
        ? `<span class="badge reviewed">${escapeHtml(formatVerdict(record.metadata.verdict))}</span>`
        : "";
      return `<article class="record ${escapeHtml(record.kind)}" data-id="${record.id}">
        <div class="record-main">
          <div class="record-head">
            <div>
              <div class="record-type">${escapeHtml(formatKind(record.kind))}</div>
              <h3 class="record-title">${escapeHtml(record.title)}</h3>
            </div>
            <time class="record-time" datetime="${escapeHtml(record.occurredAt)}">${relativeTime(record.occurredAt)}</time>
          </div>
          <p class="record-body">${escapeHtml(record.body)}</p>
          <div class="record-meta">
            <span class="badge source">${escapeHtml(formatSource(record.source))}</span>
            <span class="badge ${record.status}">${record.status === "reviewed" ? escapeHtml(t("reviewedStatus")) : escapeHtml(t("capturedStatus"))}</span>
            <span class="badge truth">${escapeHtml(formatTruth(record.truth))}</span>
            ${metadataVerdict}
            ${record.externalRef ? `<span class="external-ref" title="${escapeHtml(record.externalRef)}">${escapeHtml(record.externalRef)}</span>` : ""}
            ${record.status === "captured" ? `<button class="review-button" data-review="${record.id}">${escapeHtml(t("reviewAsFact"))}</button>` : ""}
          </div>
        </div>
      </article>`;
    })
    .join("");

  $$('[data-review]').forEach((button) => button.addEventListener("click", () => reviewEvidence(button)));
}

async function reviewEvidence(button) {
  button.disabled = true;
  button.textContent = t("reviewing");
  try {
    await api(`/api/projects/${state.dashboard.project.slug}/records/${button.dataset.review}/review`, {
      method: "POST",
      body: JSON.stringify({ actor: "demo-owner", note: t("reviewNote") }),
    });
    await loadDashboard(state.dashboard.project.slug);
    toast(t("acceptedToast"));
  } catch (error) {
    button.disabled = false;
    button.textContent = t("reviewAsFact");
    toast(error.message);
  }
}

async function copyCapture() {
  const command = $("#capture-command").textContent;
  await navigator.clipboard.writeText(command);
  toast(t("captureCopied"));
}

async function seedDemo() {
  const button = $("#seed-button");
  button.disabled = true;
  button.textContent = t("seeding");
  try {
    const result = await api("/api/demo/seed", { method: "POST", body: JSON.stringify({}) });
    await loadProjects(result.project.slug);
    toast(t("demoReady"));
  } catch (error) {
    toast(error.message);
  } finally {
    button.disabled = false;
    button.textContent = t("seedDemo");
  }
}

function bindEvents() {
  $("#project-select").addEventListener("change", (event) => loadDashboard(event.target.value));
  $("#refresh-button").addEventListener("click", () => state.dashboard && loadDashboard(state.dashboard.project.slug));
  $("#seed-button").addEventListener("click", seedDemo);
  $("#copy-capture").addEventListener("click", copyCapture);
  $("#copy-terminal").addEventListener("click", copyCapture);
  $$('[data-locale]').forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.locale === state.locale) return;
      state.locale = button.dataset.locale;
      localStorage.setItem("octura.locale", state.locale);
      applyLocale();
    });
  });
  $$(".filter").forEach((button) => {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter;
      $$(".filter").forEach((item) => item.classList.toggle("active", item === button));
      renderTimeline();
    });
  });
}

async function init() {
  bindEvents();
  applyLocale();
  const querySlug = new URLSearchParams(window.location.search).get("project");
  const preferredSlug = querySlug ?? localStorage.getItem("octura.project");
  try {
    await loadProjects(preferredSlug);
  } catch (error) {
    $("#empty-state").classList.remove("hidden");
    $("#empty-state h1").textContent = t("databaseWaiting");
    $("#empty-state p").textContent = error.message;
  }

  setInterval(() => {
    if (!document.hidden && state.dashboard) loadDashboard(state.dashboard.project.slug, true);
  }, 6000);
}

init();
