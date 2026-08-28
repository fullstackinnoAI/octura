import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { ZodError, z } from "zod";
import { closeDatabase, migrate, sql } from "./db.js";
import { projectInput, recordInput, recordQuery, reviewInput } from "./domain.js";
import {
  createRecord,
  getProject,
  getProjectSummary,
  listProjects,
  listRecords,
  reviewRecord,
  upsertProject,
} from "./repository.js";

const app = new Hono();
const port = Number(process.env.PORT ?? 3000);
const publicRoot = join(process.cwd(), "public");

app.use("/api/*", async (context, next) => {
  await next();
  context.header("Cache-Control", "no-store");
  context.header("X-Octura-Version", "0.1.0");
});

app.get("/health", async (context) => {
  await sql`SELECT 1`;
  return context.json({ status: "ok", product: "Octura", version: "0.1.0", database: "connected" });
});

app.get("/api/projects", async (context) => {
  return context.json({ schemaVersion: "octura.api.v1", data: await listProjects() });
});

app.post("/api/projects", async (context) => {
  const input = projectInput.parse(await context.req.json());
  const project = await upsertProject(input);
  return context.json({ schemaVersion: "octura.api.v1", data: project }, 201);
});

app.get("/api/projects/:slug", async (context) => {
  const project = await getProject(context.req.param("slug"));
  if (!project) return context.json({ error: { code: "project_not_found", message: "未找到项目" } }, 404);
  return context.json({ schemaVersion: "octura.api.v1", data: project });
});

app.get("/api/projects/:slug/dashboard", async (context) => {
  const project = await getProject(context.req.param("slug"));
  if (!project) return context.json({ error: { code: "project_not_found", message: "未找到项目" } }, 404);

  const [summary, records] = await Promise.all([
    getProjectSummary(project.id),
    listRecords(project.id, { limit: 100 }),
  ]);
  return context.json({ schemaVersion: "octura.api.v1", data: { project, summary, records } });
});

app.get("/api/projects/:slug/records", async (context) => {
  const project = await getProject(context.req.param("slug"));
  if (!project) return context.json({ error: { code: "project_not_found", message: "未找到项目" } }, 404);

  const filters = recordQuery.parse(context.req.query());
  const records = await listRecords(project.id, filters);
  return context.json({ schemaVersion: "octura.api.v1", data: records });
});

app.post("/api/projects/:slug/records", async (context) => {
  const project = await getProject(context.req.param("slug"));
  if (!project) return context.json({ error: { code: "project_not_found", message: "未找到项目" } }, 404);

  const input = recordInput.parse(await context.req.json());
  const record = await createRecord(project.id, input);
  return context.json({ schemaVersion: "octura.api.v1", data: record }, 201);
});

app.post("/api/projects/:slug/records/:id/review", async (context) => {
  const project = await getProject(context.req.param("slug"));
  if (!project) return context.json({ error: { code: "project_not_found", message: "未找到项目" } }, 404);

  const input = reviewInput.parse(await context.req.json().catch(() => ({})));
  const record = await reviewRecord(project.id, context.req.param("id"), input);
  if (!record) return context.json({ error: { code: "record_not_found", message: "未找到证据记录" } }, 404);
  return context.json({ schemaVersion: "octura.api.v1", data: record });
});

const seedRequest = z.object({
  slug: z.string().default("octura-demo"),
  name: z.string().default("Octura 中文演示"),
});

app.post("/api/demo/seed", async (context) => {
  const request = seedRequest.parse(await context.req.json().catch(() => ({})));
  const project = await upsertProject(
    projectInput.parse({
      slug: request.slug,
      name: request.name,
      description: "一条可追溯、可验证、可承担的 AI 产品交付证据链。",
    }),
  );

  const now = Date.now();
  const demoRecords = [
    {
      kind: "conversation",
      title: "定义聚焦的产品证据工作台",
      body: "团队需要一个最低可用产品：通过 CLI 采集 AI 协作过程，并在本地工作台展示可信记录。",
      source: "codex",
      actor: "woo + codex",
      truth: "raw",
      idempotencyKey: "demo-conversation",
      occurredAt: new Date(now - 1000 * 60 * 72).toISOString(),
      reviewed: true,
      metadata: { session: "productization-kickoff" },
    },
    {
      kind: "requirement",
      title: "呈现可审计的 AI 交付链路",
      body: "访问者需要快速理解提出了什么需求、发生了什么变更、证据来自哪里，以及是否经过人工审核。",
      source: "human",
      actor: "woo",
      truth: "raw",
      idempotencyKey: "demo-requirement",
      occurredAt: new Date(now - 1000 * 60 * 58).toISOString(),
      reviewed: true,
      metadata: { priority: "P0", acceptance: "CLI、PostgreSQL 与 Web 在同一条本地链路中闭环" },
    },
    {
      kind: "decision",
      title: "Octura 聚焦记录事实，而不是替代执行工具",
      body: "Octura 负责沉淀产品事实和交付证据；Codex、Cursor、Claude Code 与 CI 继续负责具体执行。",
      source: "human",
      actor: "woo",
      truth: "raw",
      idempotencyKey: "demo-decision",
      occurredAt: new Date(now - 1000 * 60 * 44).toISOString(),
      reviewed: true,
      metadata: { principle: "AI 可以起草，人类负责确认事实" },
    },
    {
      kind: "code",
      title: "CLI 证据采集链路已经实现",
      body: "Octura CLI 已能通过稳定的本地 API 创建项目、采集证据、查看历史，并提交人工审核。",
      source: "git",
      actor: "codex",
      truth: "raw",
      externalRef: "git:main:working-tree",
      idempotencyKey: "demo-code",
      occurredAt: new Date(now - 1000 * 60 * 27).toISOString(),
      reviewed: true,
      metadata: { files: ["src/cli.ts", "src/server.ts", "src/repository.ts"] },
    },
    {
      kind: "test",
      title: "Docker 冒烟测试通过",
      body: "本地服务已成功启动，PostgreSQL 状态健康，API 可以正确写入并返回产品证据。",
      source: "ci",
      actor: "local-smoke-test",
      truth: "raw",
      externalRef: "local://docker-compose/smoke",
      idempotencyKey: "demo-test",
      occurredAt: new Date(now - 1000 * 60 * 12).toISOString(),
      reviewed: false,
      metadata: { verdict: "passed", environment: "docker-compose" },
    },
    {
      kind: "verification",
      title: "演示链路等待最终人工确认",
      body: "检查工作台、现场运行 CLI 采集命令，并确认新记录连同原始来源一起出现在时间线中。",
      source: "human",
      actor: "demo-owner",
      truth: "derived",
      idempotencyKey: "demo-verification",
      occurredAt: new Date(now - 1000 * 60 * 4).toISOString(),
      reviewed: false,
      metadata: { checklist: ["打开工作台", "采集记录", "审核证据"] },
    },
  ] as const;

  const records = [];
  for (const item of demoRecords) {
    const { reviewed, ...data } = item;
    const record = await createRecord(project.id, recordInput.parse(data));
    records.push(reviewed ? await reviewRecord(project.id, record.id, { actor: "woo", note: "已确认为发布演示中的可信事实" }) : record);
  }

  return context.json({
    schemaVersion: "octura.api.v1",
    data: { project, records, dashboardUrl: `/?project=${project.slug}` },
  });
});

app.get("/app.css", serveStatic({ path: "./public/app.css" }));
app.get("/app.js", serveStatic({ path: "./public/app.js" }));
app.get("/assets/*", serveStatic({ root: "./public" }));
app.get("*", async (context) => context.html(await readFile(join(publicRoot, "index.html"), "utf8")));

app.onError((error, context) => {
  if (error instanceof ZodError) {
    return context.json(
      { error: { code: "validation_error", message: error.issues.map((issue) => issue.message).join("; ") } },
      400,
    );
  }
  console.error(error);
  return context.json({ error: { code: "internal_error", message: "Octura 暂时无法完成当前请求" } }, 500);
});

await migrate();

const server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Octura is ready at http://localhost:${info.port}`);
});

async function shutdown(signal: string) {
  console.log(`Received ${signal}; closing Octura`);
  server.close();
  await closeDatabase();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
