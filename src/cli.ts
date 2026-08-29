#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { parseArgs } from "node:util";
import { resolveCommandPositionals } from "./cli-command.js";
import { formatKind, recordInput, recordKinds, recordSources } from "./domain.js";
import {
  discoverSpecKitArtifacts,
  specKitArtifactRecord,
  specKitIndexRelativePath,
  writeSpecKitIndex,
  type SpecKitImportedArtifact,
} from "./spec-kit.js";

const apiUrl = (process.env.OCTURA_API_URL ?? "http://localhost:3000").replace(/\/$/, "");
const color = process.stdout.isTTY;
const paint = (code: number, value: string) => (color ? `\u001b[${code}m${value}\u001b[0m` : value);
const bold = (value: string) => paint(1, value);
const cyan = (value: string) => paint(36, value);
const green = (value: string) => paint(32, value);
const amber = (value: string) => paint(33, value);

const { positionals: rawPositionals, values } = parseArgs({
  allowPositionals: true,
  strict: true,
  options: {
    slug: { type: "string", short: "s" },
    name: { type: "string", short: "n" },
    description: { type: "string", short: "d" },
    profile: { type: "string" },
    root: { type: "string", short: "r" },
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
    "dry-run": { type: "boolean" },
    help: { type: "boolean", short: "h" },
  },
});
const positionals = resolveCommandPositionals(process.argv[1], rawPositionals);

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
  octura-doctor
  octura-demo-seed
  octura-demo-seed --profile specloop-core

${bold("项目")}
  octura-project-create --slug octura-demo --name "Octura 中文演示"
  octura-project-list

${bold("Spec Kit 兼容")}
  octura-spec-kit-import --root . --project octura-demo
  octura-spec-kit-import --root . --project octura-demo --dry-run

${bold("证据记录")}
  octura-record-add --project octura-demo --kind decision --title "保留交付证据" --body "关键事实需要人工确认" --source human
  octura-record-list --project octura-demo
  octura-record-review --project octura-demo --id <record-id> --note "已确认"

记录类型: ${recordKinds.join(", ")}
证据来源: ${recordSources.join(", ")}
API: ${apiUrl}`);
}

function inferredProjectSlug(root: string): string {
  const normalized = basename(root)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
  return normalized.length >= 2 ? normalized : "oct-spec-kit";
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
      {
        method: "POST",
        body: JSON.stringify({
          profile: values.profile,
          slug: values.project ?? values.slug,
          name: values.name,
        }),
      },
    );
    return output(result, () => {
      console.log(`${green("✓")} 已为 ${bold(result.project.name)} 生成 ${result.records.length} 条证据记录`);
      console.log(`  打开 ${cyan(`${apiUrl}${result.dashboardUrl}`)}`);
    });
  }

  if (domain === "spec-kit" && action === "import") {
    const discovered = await discoverSpecKitArtifacts((values.root as string | undefined) ?? process.cwd());
    if (!discovered.artifacts.length) {
      throw new Error(`在 ${discovered.root} 中未发现可导入的 Spec Kit 记录`);
    }

    const slug = (values.project as string | undefined) ?? (values.slug as string | undefined) ?? inferredProjectSlug(discovered.root);
    const summary = discovered.artifacts.map((artifact) => ({
      path: artifact.relativePath,
      family: artifact.family,
      slug: artifact.slug,
      stage: artifact.stage,
      kind: artifact.kind,
      title: artifact.title,
      contentSha256: artifact.contentSha256,
    }));

    if (values["dry-run"]) {
      return output(
        { dryRun: true, root: discovered.root, project: slug, artifacts: summary },
        () => {
          console.log(`${green("✓")} 在 ${bold(discovered.root)} 发现 ${discovered.artifacts.length} 条 Spec Kit 记录`);
          for (const artifact of summary) console.log(`  ${cyan(artifact.kind.padEnd(13))} ${artifact.path}`);
          console.log(`  未写入 API 或 ${specKitIndexRelativePath}`);
        },
      );
    }

    const project = await request<{ slug: string; name: string; description: string }>("/api/projects", {
      method: "POST",
      body: JSON.stringify({
        slug,
        name: values.name ?? basename(discovered.root),
        description: values.description ?? "从 Spec Kit 只读导入的产品事实与交付证据。",
      }),
    });

    const imported: SpecKitImportedArtifact[] = [];
    for (const artifact of discovered.artifacts) {
      const input = recordInput.parse(specKitArtifactRecord(artifact));
      const record = await request<{ id: string; status: string }>(`/api/projects/${project.slug}/records`, {
        method: "POST",
        body: JSON.stringify(input),
      });
      imported.push({ ...artifact, recordId: record.id, status: record.status });
    }

    const indexPath = await writeSpecKitIndex(discovered.root, project.slug, imported);
    return output(
      {
        project,
        root: discovered.root,
        imported: imported.length,
        indexPath,
        artifacts: imported.map((artifact) => ({
          path: artifact.relativePath,
          recordId: artifact.recordId,
          status: artifact.status,
          contentSha256: artifact.contentSha256,
        })),
      },
      () => {
        console.log(`${green("✓")} 已将 ${imported.length} 条 Spec Kit 记录导入项目 ${bold(project.name)}`);
        console.log(`  只读来源  ${cyan(join(discovered.root, ".specify"))}`);
        console.log(`  Octura 索引 ${cyan(indexPath)}`);
      },
    );
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
      if (!projects.length) return console.log("暂无项目。请运行：octura-demo-seed");
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
    if (values.source) query.set("source", values.source as string);
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

  throw new Error(`未知命令：${positionals.join(" ")}。请对具体命令使用 --help，例如 octura-doctor --help`);
}

main().catch((error: unknown) => {
  console.error(`${paint(31, "错误：")} ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
