import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import {
  getRecordingProtocol,
  projectInput,
  recordCreateInput,
  recordKinds,
  recordStatuses,
  sourceTypes,
} from "./domain.js";
import { resolveCommandPositionals } from "./cli-command.js";

type Envelope<T> = {
  schemaVersion: string;
  ok: boolean;
  data: T;
  error: { code: string; message: string; details?: unknown } | null;
  idempotentReplay?: boolean;
};

const apiUrl = (process.env.OCTURA_API_URL ?? "http://localhost:3000").replace(/\/$/, "");
const color = process.stdout.isTTY;
const paint = (code: number, value: string) => (color ? `\u001b[${code}m${value}\u001b[0m` : value);
const bold = (value: string) => paint(1, value);
const cyan = (value: string) => paint(36, value);
const green = (value: string) => paint(32, value);

async function stdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

async function jsonFile(path: string | undefined): Promise<Record<string, unknown>> {
  if (!path) throw new Error("该命令需要 --file <json>；使用 --file - 可从 stdin 读取");
  const raw = path === "-" ? await stdin() : await readFile(path, "utf8");
  return JSON.parse(raw) as Record<string, unknown>;
}

async function request<T>(path: string, init?: RequestInit): Promise<{ data: T; idempotentReplay: boolean }> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", "X-Octura-Surface": "cli", "X-Request-Id": randomUUID(), ...(init?.headers ?? {}) },
  });
  const envelope = (await response.json()) as Envelope<T>;
  if (!response.ok || !envelope.ok) {
    const details = envelope.error?.details ? `\n${JSON.stringify(envelope.error.details, null, 2)}` : "";
    throw new Error(`${envelope.error?.code ?? `http_${response.status}`}: ${envelope.error?.message ?? response.statusText}${details}`);
  }
  return { data: envelope.data, idempotentReplay: Boolean(envelope.idempotentReplay) };
}

function help() {
  console.log(`${bold("Octura 1.0 CLI")} · 详细记录与展示工作台

${bold("协议")}
  octura-record-prompt [--json]

${bold("项目")}
  octura-project-create --slug octura-demo --name "Octura Demo"
  octura-project-list
  octura-project-show --project octura-demo

${bold("批量采集")}
  octura-capture-add --project octura-demo --file capture.json

${bold("实时 Session")}
  octura-session-start --project octura-demo --file session.json
  octura-session-append --project octura-demo --session <id> --file messages.json
  octura-session-close --project octura-demo --session <id> --file close.json

${bold("Record")}
  octura-record-add --project octura-demo --file record.json
  octura-record-list --project octura-demo --status captured --q "支付"
  octura-record-get --project octura-demo --id <id>
  octura-record-review --project octura-demo --id <id> --action confirm --reviewer woo --note "已核对" --idempotency-key review-1
  octura-record-supersede --project octura-demo --id <id> --file supersede.json

${bold("运行")}
  octura-mcp
  octura-doctor
  octura-demo-seed --profile specloop-core

记录类型: ${recordKinds.join(", ")}
记录状态: ${recordStatuses.join(", ")}
来源类型: ${sourceTypes.join(", ")}
API: ${apiUrl}`);
}

function render(value: unknown, json: boolean, replay = false) {
  if (json) return console.log(JSON.stringify(value, null, 2));
  if (Array.isArray(value)) {
    for (const item of value as Array<Record<string, unknown>>) console.log(`${cyan(String(item.slug ?? item.id ?? ""))}  ${String(item.name ?? item.title ?? "")}`);
    return;
  }
  if (value && typeof value === "object") {
    const item = value as Record<string, unknown>;
    const record = (item.record ?? item.session ?? item) as Record<string, unknown>;
    console.log(`${green("✓")} ${String(record.title ?? record.name ?? "Octura 命令完成")}${replay ? "（幂等重放）" : ""}`);
    if (record.id) console.log(`  ID       ${record.id}`);
    if (record.status) console.log(`  状态     ${record.status}`);
    if (item.nextCursor) console.log(`  下一页   ${item.nextCursor}`);
    return;
  }
  console.log(String(value));
}

function required(values: Record<string, string | boolean | undefined>, key: string): string {
  const value = values[key];
  if (typeof value !== "string" || !value.trim()) throw new Error(`缺少 --${key}`);
  return value;
}

export async function runCli(): Promise<void> {
  const parsed = parseArgs({
    allowPositionals: true,
    strict: true,
    options: {
      help: { type: "boolean", short: "h" }, json: { type: "boolean" }, file: { type: "string", short: "f" },
      project: { type: "string", short: "p" }, slug: { type: "string" }, name: { type: "string", short: "n" }, description: { type: "string", short: "d" },
      id: { type: "string" }, session: { type: "string" }, profile: { type: "string" }, title: { type: "string", short: "t" },
      kind: { type: "string", short: "k" }, body: { type: "string" }, result: { type: "string" }, goal: { type: "string" },
      status: { type: "string" }, q: { type: "string" }, cursor: { type: "string" }, limit: { type: "string" }, from: { type: "string" }, to: { type: "string" },
      "source-name": { type: "string" }, "source-type": { type: "string" }, "actor-name": { type: "string" }, "actor-type": { type: "string" },
      "outcome-status": { type: "string" }, truth: { type: "string" }, "external-ref": { type: "string" },
      role: { type: "string" }, content: { type: "string" }, "expected-sequence": { type: "string" },
      action: { type: "string" }, reviewer: { type: "string" }, note: { type: "string" }, reason: { type: "string" },
      "idempotency-key": { type: "string" },
    },
  });
  const positionals = resolveCommandPositionals(process.argv[1], parsed.positionals);
  const values = parsed.values as Record<string, string | boolean | undefined>;
  const json = Boolean(values.json);
  const [domain, action] = positionals;
  if (values.help || !domain) return help();

  if (domain === "record" && action === "prompt") return render(getRecordingProtocol(), json);
  if (domain === "mcp") {
    const { runMcpServer } = await import("./mcp.js");
    return runMcpServer();
  }
  if (domain === "doctor") {
    try {
      const response = await fetch(`${apiUrl}/health`);
      const health = await response.json() as { database?: string; error?: string };
      if (!response.ok) throw new Error(`database_unavailable: ${health.error ?? `HTTP ${response.status}`}`);
      return render(health, json);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("database_unavailable:")) throw error;
      throw new Error(`server_unreachable: 无法连接 ${apiUrl}`);
    }
  }
  if (domain === "demo" && action === "seed") {
    const result = await request<Record<string, unknown>>("/api/v1/demo/seed", { method: "POST", body: JSON.stringify({ profile: values.profile ?? "octura" }) });
    return render(result.data, json, result.idempotentReplay);
  }
  if (domain === "project" && action === "list") {
    const result = await request<Array<Record<string, unknown>>>("/api/v1/projects");
    return render(result.data, json);
  }
  if (domain === "project" && action === "create") {
    const input = values.file ? projectInput.parse(await jsonFile(String(values.file))) : projectInput.parse({ slug: required(values, "slug"), name: required(values, "name"), description: values.description ?? "" });
    const result = await request<Record<string, unknown>>("/api/v1/projects", { method: "POST", body: JSON.stringify(input) });
    return render(result.data, json);
  }
  if (domain === "project" && action === "show") {
    const result = await request<Record<string, unknown>>(`/api/v1/projects/${encodeURIComponent(required(values, "project"))}`);
    return render(result.data, json);
  }

  const project = required(values, "project");
  if (domain === "capture" && action === "add") {
    const result = await request<Record<string, unknown>>(`/api/v1/projects/${encodeURIComponent(project)}/captures`, { method: "POST", body: JSON.stringify(await jsonFile(values.file as string | undefined)) });
    return render(result.data, json, result.idempotentReplay);
  }
  if (domain === "session" && action === "start") {
    const input = values.file ? await jsonFile(String(values.file)) : {
      title: required(values, "title"), sourceType: values["source-type"] ?? "agent", sourceName: values["source-name"] ?? "codex",
      actorType: values["actor-type"] ?? "agent", actorName: values["actor-name"] ?? values["source-name"] ?? "codex", externalRefs: [],
      idempotencyKey: required(values, "idempotency-key"),
    };
    const result = await request<Record<string, unknown>>(`/api/v1/projects/${encodeURIComponent(project)}/sessions`, { method: "POST", body: JSON.stringify(input) });
    return render(result.data, json, result.idempotentReplay);
  }
  if (domain === "session" && action === "append") {
    const session = required(values, "session");
    const input = values.file ? await jsonFile(String(values.file)) : {
      expectedSequence: Number(required(values, "expected-sequence")), messages: [{ role: required(values, "role"), content: required(values, "content") }],
      idempotencyKey: required(values, "idempotency-key"),
    };
    const result = await request<Record<string, unknown>>(`/api/v1/projects/${encodeURIComponent(project)}/sessions/${session}/messages`, { method: "POST", body: JSON.stringify(input) });
    return render(result.data, json, result.idempotentReplay);
  }
  if (domain === "session" && action === "close") {
    const session = required(values, "session");
    const input = values.file ? await jsonFile(String(values.file)) : { action: values.action ?? "abandon", reason: values.reason, records: [], idempotencyKey: required(values, "idempotency-key") };
    const result = await request<Record<string, unknown>>(`/api/v1/projects/${encodeURIComponent(project)}/sessions/${session}/close`, { method: "POST", body: JSON.stringify(input) });
    return render(result.data, json, result.idempotentReplay);
  }
  if (domain === "record" && action === "add") {
    const recordResult = values.result ?? values.body;
    const input = values.file ? await jsonFile(String(values.file)) : recordCreateInput.parse({
      kind: required(values, "kind"), title: required(values, "title"), outcomeStatus: values["outcome-status"] ?? "completed",
      intent: { goal: values.goal ?? recordResult ?? required(values, "result"), constraints: [], acceptance: [] }, result: recordResult,
      provenance: { truth: values.truth ?? "raw", sourceType: values["source-type"] ?? "human", sourceName: values["source-name"] ?? "human", actorType: values["actor-type"] ?? "human", actorName: values["actor-name"] ?? "local-user" },
      externalRefs: values["external-ref"] ? [{ type: "other", value: values["external-ref"] }] : [], idempotencyKey: required(values, "idempotency-key"),
    });
    const result = await request<Record<string, unknown>>(`/api/v1/projects/${encodeURIComponent(project)}/records`, { method: "POST", body: JSON.stringify(input) });
    return render(result.data, json, result.idempotentReplay);
  }
  if (domain === "record" && action === "list") {
    const query = new URLSearchParams();
    for (const [key, target] of [["status", "status"], ["kind", "kind"], ["q", "q"], ["cursor", "cursor"], ["limit", "limit"], ["from", "from"], ["to", "to"], ["source-name", "sourceName"], ["actor-name", "actorName"]] as const) {
      if (typeof values[key] === "string") query.set(target, values[key]);
    }
    const result = await request<{ items: Array<Record<string, unknown>>; nextCursor: string | null }>(`/api/v1/projects/${encodeURIComponent(project)}/records?${query}`);
    return render(json ? result.data : result.data.items, json);
  }
  if (domain === "record" && action === "get") {
    const result = await request<Record<string, unknown>>(`/api/v1/projects/${encodeURIComponent(project)}/records/${required(values, "id")}`);
    return render(result.data, json);
  }
  if (domain === "record" && action === "review") {
    const input = { action: values.action ?? "confirm", reviewer: required(values, "reviewer"), attestation: "human_reviewed", note: required(values, "note"), idempotencyKey: required(values, "idempotency-key") };
    const result = await request<Record<string, unknown>>(`/api/v1/projects/${encodeURIComponent(project)}/records/${required(values, "id")}/reviews`, { method: "POST", body: JSON.stringify(input) });
    return render(result.data, json, result.idempotentReplay);
  }
  if (domain === "record" && action === "supersede") {
    const result = await request<Record<string, unknown>>(`/api/v1/projects/${encodeURIComponent(project)}/records/${required(values, "id")}/supersede`, { method: "POST", body: JSON.stringify(await jsonFile(values.file as string | undefined)) });
    return render(result.data, json, result.idempotentReplay);
  }
  throw new Error(`未知命令：${positionals.join(" ")}`);
}

export function runCliEntrypoint(): void {
  void runCli().catch((error) => {
    console.error(`Octura CLI: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
