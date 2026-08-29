const baseUrl = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const runId = Date.now().toString(36);
const slug = `smoke-${runId}`;
const checks = [];

function expect(condition, message, details) {
  if (!condition) throw new Error(`${message}${details ? `: ${JSON.stringify(details)}` : ""}`);
  checks.push(message);
}

async function request(path, { method = "GET", body, expected = [200] } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json", "x-octura-surface": "api" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json();
  expect(expected.includes(response.status), `${method} ${path} -> ${expected.join("|")}`, { status: response.status, payload });
  return { status: response.status, payload };
}

function record(key, title, overrides = {}) {
  return {
    kind: "change",
    title,
    outcomeStatus: "completed",
    intent: { goal: "验证 Octura 1.0 记录契约", constraints: ["不得静默修改"], acceptance: ["可从详情页独立理解"] },
    result: `${title} 已完成，并保留了来源、验证和后续动作。`,
    changes: [{ scope: "scripts/smoke.mjs", description: "写入真实 PostgreSQL 的端到端验证记录。" }],
    decisions: [],
    verification: [{ name: "Octura smoke", status: "passed", details: "由隔离 Docker 栈执行" }],
    risks: [],
    nextSteps: ["检查审核历史与取代链"],
    externalRefs: [{ type: "file", value: "scripts/smoke.mjs" }],
    provenance: { truth: "derived", sourceType: "agent", sourceName: "smoke", actorType: "agent", actorName: "smoke" },
    occurredAt: new Date().toISOString(),
    idempotencyKey: `${slug}:${key}`,
    ...overrides,
  };
}

await request("/health");
await request("/api/v1/protocols/record");
await request("/api/v1/projects", {
  method: "POST",
  expected: [201],
  body: { slug, name: `Octura smoke ${runId}`, description: "隔离的端到端稳定版验证" },
});

const captureBody = {
  schemaVersion: "octura.capture.v1",
  idempotencyKey: `${slug}:capture`,
  session: {
    title: "批量 Capture 原子性验证",
    sourceType: "agent",
    sourceName: "smoke",
    actorType: "agent",
    actorName: "smoke",
    externalRefs: [],
    messages: [
      { role: "user", content: "请验证 Octura 批量记录。", actorName: "tester" },
      { role: "assistant", content: "将写入 Session、消息和两条 Record。", actorName: "smoke" },
    ],
  },
  records: [record("capture-record-1", "批量采集记录一"), record("capture-record-2", "批量采集记录二", { kind: "test" })],
};
const capture = await request(`/api/v1/projects/${slug}/captures`, { method: "POST", expected: [201], body: captureBody });
const firstId = capture.payload.data.records[0].id;
const secondId = capture.payload.data.records[1].id;
expect(capture.payload.data.records.length === 2, "批量 Capture 同时写入多条 Record");

const replay = await request(`/api/v1/projects/${slug}/captures`, { method: "POST", body: captureBody });
expect(replay.payload.idempotentReplay === true, "相同幂等键与请求返回原结果");
await request(`/api/v1/projects/${slug}/captures`, {
  method: "POST",
  expected: [409],
  body: { ...captureBody, session: { ...captureBody.session, title: "不同的请求" } },
});

const list = await request(`/api/v1/projects/${slug}/records?q=${encodeURIComponent("批量采集")}&limit=1`);
expect(list.payload.data.items.length === 1 && list.payload.data.nextCursor, "搜索与游标分页可用");

await request(`/api/v1/projects/${slug}/records/${firstId}/reviews`, {
  method: "POST",
  body: { action: "confirm", reviewer: "smoke-human", attestation: "human_reviewed", note: "已核对原始 Session", idempotencyKey: `${slug}:confirm` },
});
await request(`/api/v1/projects/${slug}/records/${firstId}/reviews`, {
  method: "POST",
  expected: [409],
  body: { action: "confirm", reviewer: "smoke-human", attestation: "human_reviewed", note: "重复状态转换", idempotencyKey: `${slug}:invalid-confirm` },
});

const start = await request(`/api/v1/projects/${slug}/sessions`, {
  method: "POST",
  expected: [201],
  body: { title: "实时 Session 顺序验证", sourceType: "agent", sourceName: "smoke", actorType: "agent", actorName: "smoke", externalRefs: [], idempotencyKey: `${slug}:start` },
});
const sessionId = start.payload.data.id;
await request(`/api/v1/projects/${slug}/sessions/${sessionId}/messages`, {
  method: "POST",
  expected: [201],
  body: { expectedSequence: 1, messages: [{ role: "user", content: "第一条实时消息", actorName: "tester" }], idempotencyKey: `${slug}:append-1` },
});
await request(`/api/v1/projects/${slug}/sessions/${sessionId}/messages`, {
  method: "POST",
  expected: [409],
  body: { expectedSequence: 1, messages: [{ role: "assistant", content: "乱序消息", actorName: "smoke" }], idempotencyKey: `${slug}:append-conflict` },
});
const closed = await request(`/api/v1/projects/${slug}/sessions/${sessionId}/close`, {
  method: "POST",
  body: { action: "close", records: [record("close-record", "实时 Session 关闭成果", { kind: "summary" })], idempotencyKey: `${slug}:close` },
});
expect(closed.payload.data.session.status === "closed", "关闭 Session 与成果 Record 原子写入");

const superseded = await request(`/api/v1/projects/${slug}/records/${secondId}/supersede`, {
  method: "POST",
  expected: [201],
  body: { reason: "原验证范围不完整", replacement: record("replacement", "更完整的替代验证", { kind: "test" }), reviewer: "smoke-human", attestation: "human_reviewed", idempotencyKey: `${slug}:supersede` },
});
expect(superseded.payload.data.predecessor.status === "superseded" && superseded.payload.data.replacement.status === "captured", "取代记录不继承审核状态");

await request(`/api/v1/projects/${slug}/captures`, {
  method: "POST",
  expected: [409],
  body: {
    ...captureBody,
    idempotencyKey: `${slug}:rollback-capture`,
    session: { ...captureBody.session, title: "应整体回滚的 Capture" },
    records: [record("duplicate-record-key", "事务记录一"), record("duplicate-record-key", "事务记录二")],
  },
});
const sessions = await request(`/api/v1/projects/${slug}/sessions?q=${encodeURIComponent("应整体回滚")}`);
expect(sessions.payload.data.items.length === 0, "批量 Capture 任一 Record 失败时整体回滚");

await request(`/api/v1/projects/${slug}/records`, {
  method: "POST",
  expected: [422],
  body: record("secret", "敏感内容应被拒绝", { result: "password = super-secret-value" }),
});

const detail = await request(`/api/v1/projects/${slug}/records/${firstId}`);
expect(detail.payload.data.reviews.length === 1, "Record 详情包含追加式审核历史");
const dashboard = await request(`/api/v1/projects/${slug}/dashboard`);
expect(dashboard.payload.data.summary.sessions === 2 && dashboard.payload.data.summary.total === 4, "概览仅展示真实可计算指标");

console.log(JSON.stringify({ ok: true, project: slug, checks: checks.length, dashboard: dashboard.payload.data.summary }, null, 2));
