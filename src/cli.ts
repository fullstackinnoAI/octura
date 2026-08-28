#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { formatKind, recordKinds, recordSources } from "./domain.js";

const apiUrl = (process.env.OCTURA_API_URL ?? "http://localhost:3000").replace(/\/$/, "");
const color = process.stdout.isTTY;
const paint = (code: number, value: string) => (color ? `\u001b[${code}m${value}\u001b[0m` : value);
const bold = (value: string) => paint(1, value);
const cyan = (value: string) => paint(36, value);
const green = (value: string) => paint(32, value);
const amber = (value: string) => paint(33, value);

const { positionals, values } = parseArgs({
  allowPositionals: true,
  strict: true,
  options: {
    slug: { type: "string", short: "s" },
    name: { type: "string", short: "n" },
    description: { type: "string", short: "d" },
    project: { type: "string", short: "p" },
    kind: { type: "string", short: "k" },
    title: { type: "string", short: "t" },
    body: { type: "string", short: "b" },
    "body-file": { type: "string" },
    source: { type: "string" },
    actor: { type: "string" },
    "external-ref": { type: "string" },
    truth: { type: "string" },
    status: { type: "string" },
    id: { type: "string" },
    note: { type: "string" },
    meta: { type: "string" },
    "idempotency-key": { type: "string" },
    json: { type: "boolean" },
    help: { type: "boolean", short: "h" },
  },
});

type ApiEnvelope<T> = { schemaVersion?: string; data: T };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiUrl}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new Error(`无法连接 ${apiUrl} 上的 Octura。请先运行：docker compose up -d`);
  }

  const payload = (await response.json()) as ApiEnvelope<T> & { error?: { message?: string } };
  if (!response.ok) throw new Error(payload.error?.message ?? `请求失败，HTTP 状态码 ${response.status}`);
  return payload.data;
}

function required(name: keyof typeof values): string {
  const value = values[name];
  if (typeof value !== "string" || !value) throw new Error(`缺少必填选项 --${String(name)}`);
  return value;
}

function projectSlug(): string {
  return (values.project as string | undefined) ?? (values.slug as string | undefined) ?? "octura-demo";
}

function output(value: unknown, human: () => void) {
  if (values.json) console.log(JSON.stringify(value, null, 2));
  else human();
}

function help() {
  console.log(`${bold("Octura CLI")} · AI 软件交付的产品证据工作台

${bold("开始")}
  octura doctor
  octura demo seed

${bold("项目")}
  octura project create --slug octura-demo --name "Octura 中文演示"
  octura project list

${bold("证据记录")}
  octura record add --project octura-demo --kind decision --title "保留交付证据" --body "关键事实需要人工确认" --source human
  octura record list --project octura-demo
  octura record review --project octura-demo --id <record-id> --note "已确认"

记录类型: ${recordKinds.join(", ")}
证据来源: ${recordSources.join(", ")}
API: ${apiUrl}`);
}

async function main() {
  const [domain, action] = positionals;
  if (values.help || !domain) return help();

  if (domain === "doctor") {
    const health = await fetch(`${apiUrl}/health`).then(async (response) => {
      if (!response.ok) throw new Error(`健康检查失败，HTTP 状态码 ${response.status}`);
      return response.json() as Promise<{ status: string; version: string; database: string }>;
    });
    return output(health, () => {
      console.log(`${green("●")} Octura ${health.version} 运行正常`);
      console.log(`  API       ${apiUrl}`);
      console.log(`  数据库    ${health.database}`);
    });
  }

  if (domain === "demo" && action === "seed") {
    const result = await request<{ project: { slug: string; name: string }; records: unknown[]; dashboardUrl: string }>(
      "/api/demo/seed",
      { method: "POST", body: JSON.stringify({ slug: projectSlug(), name: values.name }) },
    );
    return output(result, () => {
      console.log(`${green("✓")} 已为 ${bold(result.project.name)} 生成 ${result.records.length} 条证据记录`);
      console.log(`  打开 ${cyan(`${apiUrl}${result.dashboardUrl}`)}`);
    });
  }

  if (domain === "project" && action === "create") {
    const slug = required("slug");
    const project = await request<{ slug: string; name: string; description: string }>("/api/projects", {
      method: "POST",
      body: JSON.stringify({ slug, name: values.name ?? slug, description: values.description ?? "" }),
    });
    return output(project, () => console.log(`${green("✓")} 项目 ${bold(project.name)}（${project.slug}）已就绪`));
  }

  if (domain === "project" && action === "list") {
    const projects = await request<Array<{ slug: string; name: string; description: string }>>("/api/projects");
    return output(projects, () => {
      if (!projects.length) return console.log("暂无项目。请运行：octura demo seed");
      for (const project of projects) console.log(`${cyan(project.slug.padEnd(20))} ${bold(project.name)}  ${project.description}`);
    });
  }

  if (domain === "record" && action === "add") {
    const body = values["body-file"] ? await readFile(values["body-file"] as string, "utf8") : required("body");
    const kind = required("kind");
    if (!recordKinds.includes(kind as (typeof recordKinds)[number])) throw new Error(`--kind 无效，可选值：${recordKinds.join(", ")}`);
    const source = (values.source as string | undefined) ?? "human";
    if (!recordSources.includes(source as (typeof recordSources)[number])) throw new Error(`--source 无效，可选值：${recordSources.join(", ")}`);

    const metadata = values.meta ? JSON.parse(values.meta as string) : {};
    const record = await request<{
      id: string;
      kind: string;
      title: string;
      status: string;
      source: string;
    }>(`/api/projects/${projectSlug()}/records`, {
      method: "POST",
      body: JSON.stringify({
        kind,
        title: required("title"),
        body,
        source,
        actor: values.actor ?? "local-user",
        externalRef: values["external-ref"],
        truth: values.truth ?? "raw",
        metadata,
        idempotencyKey: values["idempotency-key"],
      }),
    });
    return output(record, () => {
      console.log(`${green("✓")} 已采集 ${cyan(formatKind(record.kind))}：${bold(record.title)}`);
      console.log(`  ID      ${record.id}`);
      console.log(`  来源    ${record.source}`);
      console.log(`  状态    ${amber(record.status)}`);
    });
  }

  if (domain === "record" && action === "list") {
    const query = new URLSearchParams();
    if (values.status) query.set("status", values.status as string);
    if (values.kind) query.set("kind", values.kind as string);
    const records = await request<Array<{ id: string; kind: string; title: string; source: string; status: string }>>(
      `/api/projects/${projectSlug()}/records?${query}`,
    );
    return output(records, () => {
      if (!records.length) return console.log("没有符合当前查询条件的记录。");
      for (const record of records) {
        const state = record.status === "reviewed" ? green("已审核") : amber("已采集");
        console.log(`${record.id.slice(0, 8)}  ${cyan(record.kind.padEnd(13))} ${state.padEnd(color ? 19 : 10)}  ${record.title}  ${paint(2, record.source)}`);
      }
    });
  }

  if (domain === "record" && action === "review") {
    const record = await request<{ id: string; title: string; status: string }>(
      `/api/projects/${projectSlug()}/records/${required("id")}/review`,
      {
        method: "POST",
        body: JSON.stringify({ actor: values.actor ?? "local-user", note: values.note ?? "已通过 CLI 确认" }),
      },
    );
    return output(record, () => console.log(`${green("✓")} 已审核 ${bold(record.title)}（${record.id.slice(0, 8)}）`));
  }

  throw new Error(`未知命令：${positionals.join(" ")}。请运行 octura --help`);
}

main().catch((error: unknown) => {
  console.error(`${paint(31, "错误：")} ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
