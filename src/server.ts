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
  if (!project) return context.json({ error: { code: "project_not_found", message: "Project not found" } }, 404);
  return context.json({ schemaVersion: "octura.api.v1", data: project });
});

app.get("/api/projects/:slug/dashboard", async (context) => {
  const project = await getProject(context.req.param("slug"));
  if (!project) return context.json({ error: { code: "project_not_found", message: "Project not found" } }, 404);

  const [summary, records] = await Promise.all([
    getProjectSummary(project.id),
    listRecords(project.id, { limit: 100 }),
  ]);
  return context.json({ schemaVersion: "octura.api.v1", data: { project, summary, records } });
});

app.get("/api/projects/:slug/records", async (context) => {
  const project = await getProject(context.req.param("slug"));
  if (!project) return context.json({ error: { code: "project_not_found", message: "Project not found" } }, 404);

  const filters = recordQuery.parse(context.req.query());
  const records = await listRecords(project.id, filters);
  return context.json({ schemaVersion: "octura.api.v1", data: records });
});

app.post("/api/projects/:slug/records", async (context) => {
  const project = await getProject(context.req.param("slug"));
  if (!project) return context.json({ error: { code: "project_not_found", message: "Project not found" } }, 404);

  const input = recordInput.parse(await context.req.json());
  const record = await createRecord(project.id, input);
  return context.json({ schemaVersion: "octura.api.v1", data: record }, 201);
});

app.post("/api/projects/:slug/records/:id/review", async (context) => {
  const project = await getProject(context.req.param("slug"));
  if (!project) return context.json({ error: { code: "project_not_found", message: "Project not found" } }, 404);

  const input = reviewInput.parse(await context.req.json().catch(() => ({})));
  const record = await reviewRecord(project.id, context.req.param("id"), input);
  if (!record) return context.json({ error: { code: "record_not_found", message: "Record not found" } }, 404);
  return context.json({ schemaVersion: "octura.api.v1", data: record });
});

const seedRequest = z.object({
  slug: z.string().default("octura-demo"),
  name: z.string().default("Octura Launch Demo"),
});

app.post("/api/demo/seed", async (context) => {
  const request = seedRequest.parse(await context.req.json().catch(() => ({})));
  const project = await upsertProject(
    projectInput.parse({
      slug: request.slug,
      name: request.name,
      description: "A live evidence trail for AI-assisted product delivery.",
    }),
  );

  const now = Date.now();
  const demoRecords = [
    {
      kind: "conversation",
      title: "Define a focused evidence product",
      body: "The team asked for a minimum product that can capture AI work through a CLI and display trusted records locally.",
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
      title: "Show an auditable AI delivery trail",
      body: "A visitor must understand what was requested, what changed, where the evidence came from, and whether a human reviewed it.",
      source: "human",
      actor: "woo",
      truth: "raw",
      idempotencyKey: "demo-requirement",
      occurredAt: new Date(now - 1000 * 60 * 58).toISOString(),
      reviewed: true,
      metadata: { priority: "P0", acceptance: "CLI to PostgreSQL to Web in one local flow" },
    },
    {
      kind: "decision",
      title: "Keep execution outside Octura",
      body: "Octura records product truth and delivery evidence. Codex, Cursor, Claude Code and CI continue to execute the work.",
      source: "human",
      actor: "woo",
      truth: "raw",
      idempotencyKey: "demo-decision",
      occurredAt: new Date(now - 1000 * 60 * 44).toISOString(),
      reviewed: true,
      metadata: { principle: "AI can draft; humans confirm facts" },
    },
    {
      kind: "code",
      title: "CLI capture path implemented",
      body: "The Octura CLI now creates projects, captures evidence records, lists history and submits human reviews through a stable local API.",
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
      title: "Docker smoke test passed",
      body: "The local stack started, PostgreSQL became healthy, and the API accepted and returned evidence records.",
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
      title: "Launch story awaiting human sign-off",
      body: "Review the dashboard, run the CLI capture command live, and confirm that the new record appears with its original source intact.",
      source: "human",
      actor: "demo-owner",
      truth: "derived",
      idempotencyKey: "demo-verification",
      occurredAt: new Date(now - 1000 * 60 * 4).toISOString(),
      reviewed: false,
      metadata: { checklist: ["open dashboard", "capture record", "review evidence"] },
    },
  ] as const;

  const records = [];
  for (const item of demoRecords) {
    const { reviewed, ...data } = item;
    const record = await createRecord(project.id, recordInput.parse(data));
    records.push(reviewed ? await reviewRecord(project.id, record.id, { actor: "woo", note: "Accepted for the launch narrative" }) : record);
  }

  return context.json({
    schemaVersion: "octura.api.v1",
    data: { project, records, dashboardUrl: `/?project=${project.slug}` },
  });
});

app.get("/app.css", serveStatic({ path: "./public/app.css" }));
app.get("/app.js", serveStatic({ path: "./public/app.js" }));
app.get("*", async (context) => context.html(await readFile(join(publicRoot, "index.html"), "utf8")));

app.onError((error, context) => {
  if (error instanceof ZodError) {
    return context.json(
      { error: { code: "validation_error", message: error.issues.map((issue) => issue.message).join("; ") } },
      400,
    );
  }
  console.error(error);
  return context.json({ error: { code: "internal_error", message: "Octura could not complete the request" } }, 500);
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
