const state = {
  projects: [],
  dashboard: null,
  filter: "all",
  loading: false,
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const kindNames = {
  conversation: "对话记录",
  requirement: "产品需求",
  decision: "关键决策",
  code: "代码变更",
  test: "测试结果",
  verification: "人工验证",
  release: "发布事实",
};
const sourceNames = {
  human: "人工",
  codex: "Codex",
  cursor: "Cursor",
  claude: "Claude",
  git: "Git",
  ci: "CI",
  api: "API",
  other: "其他",
};

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
  if (seconds < 60) return "刚刚";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.round(hours / 24);
  return `${days} 天前`;
}

function formatKind(kind) {
  return kindNames[kind] ?? kind;
}

function formatSource(source) {
  return sourceNames[source] ?? source;
}

function formatTruth(truth) {
  return truth === "derived" ? "派生内容" : "原始证据";
}

function formatVerdict(verdict) {
  if (verdict === "passed") return "通过";
  if (verdict === "failed") return "失败";
  return verdict;
}

async function api(path, options) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error?.message ?? `请求失败（${response.status}）`);
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
  $("#sync-status").innerHTML = loading ? "同步中…" : '<span class="pulse"></span>实时同步';
  $("#refresh-button").disabled = loading;
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
      toast("已采集新的产品证据");
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
  $("#project-description").textContent = project.description || "一条可追溯、可验证的 AI 产品交付证据链。";
  $("#breadcrumb-project").textContent = project.name;
  $("#nav-count").textContent = summary.total;
  $("#metric-total").textContent = summary.total;
  $("#metric-sources").textContent = summary.sources;
  $("#metric-reviewed").textContent = summary.reviewed;
  $("#metric-captured").textContent = summary.captured;
  $("#metric-reviewed-note").textContent = summary.total ? `${Math.round((summary.reviewed / summary.total) * 100)}% 的记录已成为可信事实` : "等待建立可信事实";
  $("#metric-coverage").textContent = summary.coverage;
  $("#metric-coverage-bar").style.width = `${summary.coverage}%`;
  $("#health-badge").textContent = summary.coverage === 100 ? "完整" : "正在构建";

  const command = `octura record add \\\n  --project ${project.slug} \\\n  --kind decision \\\n  --title "保留交付证据" \\\n  --body "关键事实需要人工确认" \\\n  --source codex`;
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
        <span class="chain-count">${count ? `${count} 条记录` : "缺失"}</span>
      </div>`;
    })
    .join("");
}

function renderTimeline() {
  const records = state.dashboard.records.filter((record) => state.filter === "all" || record.status === state.filter);
  if (!records.length) {
    $("#timeline").innerHTML = '<div class="empty-filter">没有符合当前筛选条件的证据。</div>';
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
            <span class="badge ${record.status}">${record.status === "reviewed" ? "人工已审核" : "等待审核"}</span>
            <span class="badge truth">${escapeHtml(formatTruth(record.truth))}</span>
            ${metadataVerdict}
            ${record.externalRef ? `<span class="external-ref" title="${escapeHtml(record.externalRef)}">${escapeHtml(record.externalRef)}</span>` : ""}
            ${record.status === "captured" ? `<button class="review-button" data-review="${record.id}">确认为事实</button>` : ""}
          </div>
        </div>
      </article>`;
    })
    .join("");

  $$('[data-review]').forEach((button) => button.addEventListener("click", () => reviewEvidence(button)));
}

async function reviewEvidence(button) {
  button.disabled = true;
  button.textContent = "正在确认…";
  try {
    await api(`/api/projects/${state.dashboard.project.slug}/records/${button.dataset.review}/review`, {
      method: "POST",
      body: JSON.stringify({ actor: "demo-owner", note: "已在 Octura 证据工作台中确认" }),
    });
    await loadDashboard(state.dashboard.project.slug);
    toast("证据已确认为产品事实");
  } catch (error) {
    button.disabled = false;
    button.textContent = "确认为事实";
    toast(error.message);
  }
}

async function copyCapture() {
  const command = $("#capture-command").textContent;
  await navigator.clipboard.writeText(command);
  toast("采集命令已复制");
}

async function seedDemo() {
  const button = $("#seed-button");
  button.disabled = true;
  button.textContent = "正在生成演示数据…";
  try {
    const result = await api("/api/demo/seed", { method: "POST", body: JSON.stringify({}) });
    await loadProjects(result.project.slug);
    toast("中文演示数据已就绪");
  } catch (error) {
    toast(error.message);
  } finally {
    button.disabled = false;
    button.textContent = "生成中文演示数据";
  }
}

function bindEvents() {
  $("#project-select").addEventListener("change", (event) => loadDashboard(event.target.value));
  $("#refresh-button").addEventListener("click", () => state.dashboard && loadDashboard(state.dashboard.project.slug));
  $("#seed-button").addEventListener("click", seedDemo);
  $("#copy-capture").addEventListener("click", copyCapture);
  $("#copy-terminal").addEventListener("click", copyCapture);
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
  const querySlug = new URLSearchParams(window.location.search).get("project");
  const preferredSlug = querySlug ?? localStorage.getItem("octura.project");
  try {
    await loadProjects(preferredSlug);
  } catch (error) {
    $("#empty-state").classList.remove("hidden");
    $("#empty-state h1").textContent = "Octura 正在等待数据库连接。";
    $("#empty-state p").textContent = error.message;
  }

  setInterval(() => {
    if (!document.hidden && state.dashboard) loadDashboard(state.dashboard.project.slug, true);
  }, 6000);
}

init();
