const state = {
  projects: [],
  dashboard: null,
  filter: "all",
  loading: false,
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const kindMarks = {
  conversation: "C",
  requirement: "R",
  decision: "D",
  code: "</>",
  test: "T",
  verification: "V",
  release: "↗",
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
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function formatKind(kind) {
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

async function api(path, options) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error?.message ?? `Request failed (${response.status})`);
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
  $("#sync-status").innerHTML = loading ? "Syncing…" : '<span class="pulse"></span>Live';
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
      toast("New evidence captured");
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
  $("#project-description").textContent = project.description || "An auditable trail for AI-assisted delivery.";
  $("#breadcrumb-project").textContent = project.name;
  $("#nav-count").textContent = summary.total;
  $("#metric-total").textContent = summary.total;
  $("#metric-sources").textContent = summary.sources;
  $("#metric-reviewed").textContent = summary.reviewed;
  $("#metric-captured").textContent = summary.captured;
  $("#metric-reviewed-note").textContent = summary.total ? `${Math.round((summary.reviewed / summary.total) * 100)}% of all evidence` : "Trusted product facts";
  $("#metric-coverage").textContent = summary.coverage;
  $("#metric-coverage-bar").style.width = `${summary.coverage}%`;
  $("#health-badge").textContent = summary.coverage === 100 ? "Complete" : "Building";

  const command = `octura record add \\\n+  --project ${project.slug} \\\n+  --kind decision \\\n+  --title "Keep the evidence" \\\n+  --body "Human review is required" \\\n+  --source codex`;
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
        <span class="chain-state">${count ? "✓" : "·"}</span>
        <span class="chain-name">${escapeHtml(kind)}</span>
        <span class="chain-count">${count ? `${count} record${count > 1 ? "s" : ""}` : "missing"}</span>
      </div>`;
    })
    .join("");
}

function renderTimeline() {
  const records = state.dashboard.records.filter((record) => state.filter === "all" || record.status === state.filter);
  if (!records.length) {
    $("#timeline").innerHTML = '<div class="empty-filter">No evidence matches this filter.</div>';
    return;
  }

  $("#timeline").innerHTML = records
    .map((record) => {
      const metadataVerdict = record.metadata?.verdict
        ? `<span class="badge reviewed">${escapeHtml(record.metadata.verdict)}</span>`
        : "";
      return `<article class="record" data-id="${record.id}">
        <div class="record-icon ${escapeHtml(record.kind)}">${kindMarks[record.kind] ?? "·"}</div>
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
            <span class="badge source">${escapeHtml(record.source)}</span>
            <span class="badge ${record.status}">${record.status === "reviewed" ? "✓ Human reviewed" : "● Needs review"}</span>
            <span class="badge truth">${escapeHtml(record.truth)}</span>
            ${metadataVerdict}
            ${record.externalRef ? `<span class="external-ref" title="${escapeHtml(record.externalRef)}">${escapeHtml(record.externalRef)}</span>` : ""}
            ${record.status === "captured" ? `<button class="review-button" data-review="${record.id}">Review as fact</button>` : ""}
          </div>
        </div>
      </article>`;
    })
    .join("");

  $$('[data-review]').forEach((button) => button.addEventListener("click", () => reviewEvidence(button)));
}

async function reviewEvidence(button) {
  button.disabled = true;
  button.textContent = "Reviewing…";
  try {
    await api(`/api/projects/${state.dashboard.project.slug}/records/${button.dataset.review}/review`, {
      method: "POST",
      body: JSON.stringify({ actor: "demo-owner", note: "Confirmed in the Octura evidence workspace" }),
    });
    await loadDashboard(state.dashboard.project.slug);
    toast("Evidence accepted as product truth");
  } catch (error) {
    button.disabled = false;
    button.textContent = "Review as fact";
    toast(error.message);
  }
}

async function copyCapture() {
  const command = $("#capture-command").textContent;
  await navigator.clipboard.writeText(command);
  toast("Capture command copied");
}

async function seedDemo() {
  const button = $("#seed-button");
  button.disabled = true;
  button.textContent = "Seeding evidence…";
  try {
    const result = await api("/api/demo/seed", { method: "POST", body: JSON.stringify({}) });
    await loadProjects(result.project.slug);
    toast("Launch demo is ready");
  } catch (error) {
    toast(error.message);
  } finally {
    button.disabled = false;
    button.textContent = "Seed launch demo";
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
    $("#empty-state h1").textContent = "Octura is waiting for its database.";
    $("#empty-state p").textContent = error.message;
  }

  setInterval(() => {
    if (!document.hidden && state.dashboard) loadDashboard(state.dashboard.project.slug, true);
  }, 6000);
}

init();
