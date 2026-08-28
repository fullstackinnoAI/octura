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
    throw new Error(`Cannot reach Octura at ${apiUrl}. Start it with: docker compose up -d`);
  }

  const payload = (await response.json()) as ApiEnvelope<T> & { error?: { message?: string } };
  if (!response.ok) throw new Error(payload.error?.message ?? `Request failed with HTTP ${response.status}`);
  return payload.data;
}

function required(name: keyof typeof values): string {
  const value = values[name];
  if (typeof value !== "string" || !value) throw new Error(`Missing required option --${String(name)}`);
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
  console.log(`${bold("Octura CLI")} · evidence for AI software delivery

${bold("Start")}
  octura doctor
  octura demo seed

${bold("Projects")}
  octura project create --slug octura-demo --name "Octura Demo"
  octura project list

${bold("Records")}
  octura record add --project octura-demo --kind decision --title "Keep evidence" --body "Human review is required" --source human
  octura record list --project octura-demo
  octura record review --project octura-demo --id <record-id> --note "Confirmed"

Kinds: ${recordKinds.join(", ")}
Sources: ${recordSources.join(", ")}
API: ${apiUrl}`);
}

async function main() {
  const [domain, action] = positionals;
  if (values.help || !domain) return help();

  if (domain === "doctor") {
    const health = await fetch(`${apiUrl}/health`).then(async (response) => {
      if (!response.ok) throw new Error(`Health check failed with HTTP ${response.status}`);
      return response.json() as Promise<{ status: string; version: string; database: string }>;
    });
    return output(health, () => {
      console.log(`${green("●")} Octura ${health.version} is healthy`);
      console.log(`  API       ${apiUrl}`);
      console.log(`  Database  ${health.database}`);
    });
  }

  if (domain === "demo" && action === "seed") {
    const result = await request<{ project: { slug: string; name: string }; records: unknown[]; dashboardUrl: string }>(
      "/api/demo/seed",
      { method: "POST", body: JSON.stringify({ slug: projectSlug(), name: values.name }) },
    );
    return output(result, () => {
      console.log(`${green("✓")} Seeded ${bold(result.project.name)} with ${result.records.length} evidence records`);
      console.log(`  Open ${cyan(`${apiUrl}${result.dashboardUrl}`)}`);
    });
  }

  if (domain === "project" && action === "create") {
    const slug = required("slug");
    const project = await request<{ slug: string; name: string; description: string }>("/api/projects", {
      method: "POST",
      body: JSON.stringify({ slug, name: values.name ?? slug, description: values.description ?? "" }),
    });
    return output(project, () => console.log(`${green("✓")} Project ${bold(project.name)} (${project.slug}) is ready`));
  }

  if (domain === "project" && action === "list") {
    const projects = await request<Array<{ slug: string; name: string; description: string }>>("/api/projects");
    return output(projects, () => {
      if (!projects.length) return console.log("No projects yet. Run: octura demo seed");
      for (const project of projects) console.log(`${cyan(project.slug.padEnd(20))} ${bold(project.name)}  ${project.description}`);
    });
  }

  if (domain === "record" && action === "add") {
    const body = values["body-file"] ? await readFile(values["body-file"] as string, "utf8") : required("body");
    const kind = required("kind");
    if (!recordKinds.includes(kind as (typeof recordKinds)[number])) throw new Error(`Invalid --kind. Use: ${recordKinds.join(", ")}`);
    const source = (values.source as string | undefined) ?? "human";
    if (!recordSources.includes(source as (typeof recordSources)[number])) throw new Error(`Invalid --source. Use: ${recordSources.join(", ")}`);

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
      console.log(`${green("✓")} Captured ${cyan(formatKind(record.kind))}: ${bold(record.title)}`);
      console.log(`  ID      ${record.id}`);
      console.log(`  Source  ${record.source}`);
      console.log(`  Status  ${amber(record.status)}`);
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
      if (!records.length) return console.log("No records match this query.");
      for (const record of records) {
        const state = record.status === "reviewed" ? green("reviewed") : amber("captured");
        console.log(`${record.id.slice(0, 8)}  ${cyan(record.kind.padEnd(13))} ${state.padEnd(color ? 19 : 10)}  ${record.title}  ${paint(2, record.source)}`);
      }
    });
  }

  if (domain === "record" && action === "review") {
    const record = await request<{ id: string; title: string; status: string }>(
      `/api/projects/${projectSlug()}/records/${required("id")}/review`,
      {
        method: "POST",
        body: JSON.stringify({ actor: values.actor ?? "local-user", note: values.note ?? "Confirmed from the CLI" }),
      },
    );
    return output(record, () => console.log(`${green("✓")} Reviewed ${bold(record.title)} (${record.id.slice(0, 8)})`));
  }

  throw new Error(`Unknown command: ${positionals.join(" ")}. Run octura --help`);
}

main().catch((error: unknown) => {
  console.error(`${paint(31, "Error:")} ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
