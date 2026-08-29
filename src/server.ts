import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { ZodError, z } from "zod";
import { closeDatabase, migrate, sql } from "./db.js";
import {
  API_SCHEMA_VERSION,
  OcturaError,
  appendMessagesInput,
  captureInput,
  getRecordingProtocol,
  projectInput,
  recordCreateInput,
  recordQuery,
  reviewInput,
  sessionCloseInput,
  sessionQuery,
  sessionStartInput,
  supersedeInput,
} from "./domain.js";
import {
  appendMessages,
  captureActivity,
  closeSession,
  createRecord,
  getDashboard,
  getProject,
  getRecordDetail,
  getSessionDetail,
  listProjects,
  listRecords,
  listSessions,
  reviewRecord,
  startSession,
  supersedeRecord,
  upsertProject,
  type Surface,
} from "./service.js";

type AppEnv = { Variables: { requestId: string } };
const app = new Hono<AppEnv>();
const port = Number(process.env.PORT ?? 3000);
const publicRoot = join(process.cwd(), "public");
const version = "1.0.0-rc.1";

function surfaceOf(value: string | undefined): Surface {
  return value === "web" || value === "cli" || value === "mcp" ? value : "api";
}

function response(data: unknown, requestId: string, idempotentReplay = false) {
  return { schemaVersion: API_SCHEMA_VERSION, ok: true, data, error: null, requestId, idempotentReplay };
}

app.use("/api/*", async (context, next) => {
  const requestId = context.req.header("X-Request-Id") ?? randomUUID();
  context.set("requestId", requestId);
  await next();
  context.header("Cache-Control", "no-store");
  context.header("X-Octura-Version", version);
  context.header("X-Request-Id", requestId);
});

app.get("/health", async (context) => {
  try {
    await sql`SELECT 1`;
    return context.json({ status: "ok", product: "Octura", version, database: "connected" });
  } catch {
    return context.json({ status: "error", product: "Octura", version, database: "unavailable", error: "PostgreSQL is not reachable" }, 503);
  }
});

app.get("/api/v1/protocols/record", (context) => context.json(response(getRecordingProtocol(), context.get("requestId"))));

app.get("/api/v1/projects", async (context) => context.json(response(await listProjects(), context.get("requestId"))));

app.post("/api/v1/projects", async (context) => {
  const project = await upsertProject(projectInput.parse(await context.req.json()));
  return context.json(response(project, context.get("requestId")), 201);
});

app.get("/api/v1/projects/:slug", async (context) => {
  return context.json(response(await getProject(context.req.param("slug")), context.get("requestId")));
});

app.get("/api/v1/projects/:slug/dashboard", async (context) => {
  return context.json(response(await getDashboard(context.req.param("slug")), context.get("requestId")));
});

app.post("/api/v1/projects/:slug/captures", async (context) => {
  const input = captureInput.parse(await context.req.json());
  const result = await captureActivity(context.req.param("slug"), input);
  return context.json(response(result.data, context.get("requestId"), result.idempotentReplay), result.idempotentReplay ? 200 : 201);
});

app.get("/api/v1/projects/:slug/sessions", async (context) => {
  const filters = sessionQuery.parse(context.req.query());
  return context.json(response(await listSessions(context.req.param("slug"), filters), context.get("requestId")));
});

app.post("/api/v1/projects/:slug/sessions", async (context) => {
  const input = sessionStartInput.parse(await context.req.json());
  const result = await startSession(context.req.param("slug"), input);
  return context.json(response(result.data, context.get("requestId"), result.idempotentReplay), result.idempotentReplay ? 200 : 201);
});

app.get("/api/v1/projects/:slug/sessions/:id", async (context) => {
  return context.json(response(await getSessionDetail(context.req.param("slug"), context.req.param("id")), context.get("requestId")));
});

app.post("/api/v1/projects/:slug/sessions/:id/messages", async (context) => {
  const input = appendMessagesInput.parse(await context.req.json());
  const result = await appendMessages(context.req.param("slug"), context.req.param("id"), input);
  return context.json(response(result.data, context.get("requestId"), result.idempotentReplay), result.idempotentReplay ? 200 : 201);
});

app.post("/api/v1/projects/:slug/sessions/:id/close", async (context) => {
  const input = sessionCloseInput.parse(await context.req.json());
  const result = await closeSession(context.req.param("slug"), context.req.param("id"), input);
  return context.json(response(result.data, context.get("requestId"), result.idempotentReplay));
});

app.get("/api/v1/projects/:slug/records", async (context) => {
  const filters = recordQuery.parse(context.req.query());
  return context.json(response(await listRecords(context.req.param("slug"), filters), context.get("requestId")));
});

app.post("/api/v1/projects/:slug/records", async (context) => {
  const input = recordCreateInput.parse(await context.req.json());
  const result = await createRecord(context.req.param("slug"), input);
  return context.json(response(result.data, context.get("requestId"), result.idempotentReplay), result.idempotentReplay ? 200 : 201);
});

app.get("/api/v1/projects/:slug/records/:id", async (context) => {
  return context.json(response(await getRecordDetail(context.req.param("slug"), context.req.param("id")), context.get("requestId")));
});

app.post("/api/v1/projects/:slug/records/:id/reviews", async (context) => {
  const input = reviewInput.parse(await context.req.json());
  const result = await reviewRecord(
    context.req.param("slug"),
    context.req.param("id"),
    input,
    surfaceOf(context.req.header("X-Octura-Surface")),
  );
  return context.json(response(result.data, context.get("requestId"), result.idempotentReplay));
});

app.post("/api/v1/projects/:slug/records/:id/supersede", async (context) => {
  const input = supersedeInput.parse(await context.req.json());
  const result = await supersedeRecord(
    context.req.param("slug"),
    context.req.param("id"),
    input,
    surfaceOf(context.req.header("X-Octura-Surface")),
  );
  return context.json(response(result.data, context.get("requestId"), result.idempotentReplay), result.idempotentReplay ? 200 : 201);
});

const seedRequest = z.object({ profile: z.enum(["octura", "specloop-core"]).default("octura"), slug: z.string().optional(), name: z.string().optional() });

function demoRecord(kind: "summary" | "requirement" | "decision" | "change" | "test" | "verification", title: string, result: string, key: string, sourceName: string, occurredAt: string) {
  const isHuman = sourceName === "human";
  const isCi = sourceName === "ci";
  return {
    kind,
    title,
    outcomeStatus: kind === "verification" ? "partial" as const : "completed" as const,
    intent: {
      goal: kind === "summary" ? "保留一次可独立理解的 AI 开发活动" : `形成可核验的${title}`,
      constraints: ["只记录事实，不接管外部执行"],
      acceptance: ["记录可回到原始 Session、来源和外部引用"],
    },
    result,
    changes: kind === "change" ? [{ scope: "src/", description: "通过统一应用服务落地 CLI、API 与 MCP 的记录契约。" }] : [],
    decisions: kind === "decision" ? [{ decision: result, rationale: "保持产品边界简单，并让事实来源可核验。" }] : [],
    verification: kind === "test" ? [{ name: "Octura contract tests", status: "passed" as const, details: "Schema、状态机与幂等测试通过。" }] : [],
    risks: kind === "verification" ? ["审核者身份为本地调用者自我声明，未经过账号认证。"] : [],
    nextSteps: kind === "verification" ? ["由项目负责人检查 Record 详情与原始 Session。"] : [],
    externalRefs: [{ type: "file" as const, value: kind === "change" ? "src/service.ts" : "docs/product/octura-v1-spec.md" }],
    provenance: {
      truth: isHuman || isCi ? "raw" as const : "derived" as const,
      sourceType: isHuman ? "human" as const : isCi ? "ci" as const : "agent" as const,
      sourceName,
      actorType: isHuman ? "human" as const : isCi ? "system" as const : "agent" as const,
      actorName: isHuman ? "woo" : sourceName,
    },
    occurredAt,
    idempotencyKey: key,
  };
}

app.post("/api/v1/demo/seed", async (context) => {
  const input = seedRequest.parse(await context.req.json().catch(() => ({})));
  const isSpecLoop = input.profile === "specloop-core";
  const slug = input.slug ?? (isSpecLoop ? "specloop-core" : "octura-demo");
  const project = await upsertProject({
    slug,
    name: input.name ?? (isSpecLoop ? "SpecLoop Core · 真实项目演示" : "Octura 1.0 中文演示"),
    description: isSpecLoop ? "从 SpecLoop 的复杂产品边界收敛为详细记录与展示的真实重构档案。" : "完整可见对话、结构化成果、来源和人工确认组成的本地开发档案。",
  });
  const base = "2026-08-29T01:";
  const records = [
    demoRecord("summary", isSpecLoop ? "确认 SpecLoop 重构为 Octura" : "定义 Octura 1.0 记录边界", "团队保留来源追溯与人工确认，移除文档版本、Task Pack、同步和执行门禁。", `${slug}:summary:v1`, "codex", `${base}00:00.000Z`),
    demoRecord("requirement", "完整保存可见对话与成果记录", "一次开发活动必须同时保存完整可见 Session 和一到多条独立可读的结构化 Record。", `${slug}:requirement:v1`, "human", `${base}05:00.000Z`),
    demoRecord("decision", "采用批量与实时双轨采集", "短任务使用原子批量 Capture，长任务使用 start、append、close 实时 Session。", `${slug}:decision:v1`, "codex", `${base}10:00.000Z`),
    demoRecord("change", "统一记录内核已经形成", "CLI、HTTP API 与 MCP 复用同一套 Schema、幂等性和状态转换。", `${slug}:change:v1`, "codex", `${base}15:00.000Z`),
    demoRecord("test", "记录契约与状态机验证通过", "合法记录、非法状态转换、消息序号和幂等冲突均有自动化验证。", `${slug}:test:v1`, "ci", `${base}20:00.000Z`),
    demoRecord("verification", "1.0 工作台等待最终人工确认", "Record 与 Session 详情已经可展示，发布前仍需完成真实项目 dogfood。", `${slug}:verification:v1`, "codex", `${base}25:00.000Z`),
  ];
  const capture = captureInput.parse({
    idempotencyKey: `${slug}:capture:v1`,
    session: {
      title: isSpecLoop ? "SpecLoop Core → Octura 1.0 产品收敛" : "Octura 1.0 稳定版定义",
      sourceType: "agent",
      sourceName: "codex",
      actorType: "agent",
      actorName: "codex",
      externalRefs: [{ type: "file", value: "docs/product/octura-v1-spec.md" }],
      startedAt: `${base}00:00.000Z`,
      endedAt: `${base}30:00.000Z`,
      messages: [
        { role: "user", content: "Octura 第一个稳定版本只做详细记录和展示，同时保留完整可见对话。", actorName: "woo", occurredAt: `${base}00:00.000Z` },
        { role: "assistant", content: "将产品收敛为 Project、Session、Record、ReviewEvent 和 SupersedeRelation，并让 CLI、API、MCP 复用同一内核。", actorName: "codex", occurredAt: `${base}08:00.000Z` },
        { role: "tool", content: "验证摘要：当前 Octura 基线测试和 TypeScript 类型检查通过。", actorName: "local-verification", occurredAt: `${base}18:00.000Z` },
        { role: "assistant", content: "实施计划已锁定：双轨采集、结构化 Markdown、追加式审核修正和详细工作台。", actorName: "codex", occurredAt: `${base}28:00.000Z` },
      ],
    },
    records,
  });
  const captured = await captureActivity(project.slug, capture);
  for (const record of captured.data.records.slice(0, 4)) {
    await reviewRecord(project.slug, record.id, {
      action: "confirm",
      reviewer: "woo",
      attestation: "human_reviewed",
      note: "已核对原始 Session、来源与成果内容",
      idempotencyKey: `${slug}:review:${record.id}`,
    }, "web");
  }
  return context.json(response({ project, capture: captured.data, dashboardUrl: `/?project=${project.slug}` }, context.get("requestId"), captured.idempotentReplay), captured.idempotentReplay ? 200 : 201);
});

app.get("/app.css", serveStatic({ path: "./public/app.css" }));
app.get("/app.js", serveStatic({ path: "./public/app.js" }));
app.get("*", async (context) => context.html(await readFile(join(publicRoot, "index.html"), "utf8")));

app.onError((error, context) => {
  const requestId = context.get("requestId") ?? randomUUID();
  if (error instanceof ZodError) {
    return context.json({ schemaVersion: API_SCHEMA_VERSION, ok: false, data: null, error: { code: "validation_error", message: "请求不符合稳定契约", details: error.issues }, requestId }, 422);
  }
  if (error instanceof OcturaError) {
    return context.json({ schemaVersion: API_SCHEMA_VERSION, ok: false, data: null, error: { code: error.code, message: error.message, details: error.details }, requestId }, error.status as 400);
  }
  console.error(error);
  return context.json({ schemaVersion: API_SCHEMA_VERSION, ok: false, data: null, error: { code: "internal_error", message: "Octura 暂时无法完成当前请求" }, requestId }, 500);
});

await migrate();

const server = serve({ fetch: app.fetch, port }, (info) => console.log(`Octura ${version} is ready at http://localhost:${info.port}`));

async function shutdown(signal: string) {
  console.log(`Received ${signal}; closing Octura`);
  server.close();
  await closeDatabase();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
