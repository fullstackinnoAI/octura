import { z } from "zod";

export const API_SCHEMA_VERSION = "octura.api.v1" as const;
export const RECORD_SCHEMA_VERSION = "octura.record.v1" as const;
export const CAPTURE_SCHEMA_VERSION = "octura.capture.v1" as const;
export const RECORDING_PROMPT_VERSION = "octura.recording-prompt.v1" as const;

export const recordKinds = ["summary", "requirement", "decision", "change", "test", "verification", "release"] as const;
export const recordStatuses = ["captured", "reviewed", "dismissed", "retracted", "superseded"] as const;
export const sessionStatuses = ["open", "closed", "abandoned"] as const;
export const sourceTypes = ["human", "agent", "git", "ci", "import", "other"] as const;
export const actorTypes = ["human", "agent", "system"] as const;
export const messageRoles = ["user", "assistant", "system", "tool"] as const;
export const externalRefTypes = ["file", "commit", "pr", "issue", "build", "url", "other"] as const;

export const idempotencyKeySchema = z.string().min(1).max(200);

export const projectInput = z.object({
  slug: z.string().min(2).max(48).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens"),
  name: z.string().min(2).max(80),
  description: z.string().max(500).default(""),
});

export const externalRefSchema = z.object({
  type: z.enum(externalRefTypes),
  value: z.string().min(1).max(1_000),
  label: z.string().max(160).optional(),
});

export const provenanceSchema = z.object({
  truth: z.enum(["raw", "derived"]),
  sourceType: z.enum(sourceTypes),
  sourceName: z.string().min(1).max(120),
  actorType: z.enum(actorTypes),
  actorName: z.string().min(1).max(120),
});

export const recordCreateInput = z.object({
  schemaVersion: z.literal(RECORD_SCHEMA_VERSION).default(RECORD_SCHEMA_VERSION),
  sourceSessionId: z.string().uuid().optional(),
  kind: z.enum(recordKinds),
  title: z.string().min(2).max(160),
  outcomeStatus: z.enum(["completed", "partial", "blocked"]),
  intent: z.object({
    goal: z.string().min(1).max(20_000),
    constraints: z.array(z.string().min(1).max(5_000)).max(50).default([]),
    acceptance: z.array(z.string().min(1).max(5_000)).max(50).default([]),
  }),
  result: z.string().min(1).max(500_000),
  changes: z.array(z.object({ scope: z.string().min(1).max(500), description: z.string().min(1).max(20_000) })).max(200).default([]),
  decisions: z.array(z.object({ decision: z.string().min(1).max(20_000), rationale: z.string().min(1).max(20_000) })).max(100).default([]),
  verification: z.array(z.object({
    name: z.string().min(1).max(500),
    status: z.enum(["passed", "failed", "not_run", "unknown"]),
    details: z.string().max(20_000).optional(),
    ref: z.string().max(1_000).optional(),
  })).max(200).default([]),
  risks: z.array(z.string().min(1).max(10_000)).max(100).default([]),
  nextSteps: z.array(z.string().min(1).max(10_000)).max(100).default([]),
  externalRefs: z.array(externalRefSchema).max(100).default([]),
  provenance: provenanceSchema,
  occurredAt: z.string().datetime({ offset: true }).optional(),
  idempotencyKey: idempotencyKeySchema,
});

export const messageInput = z.object({
  role: z.enum(messageRoles),
  content: z.string().min(1).max(262_144),
  actorName: z.string().min(1).max(120).optional(),
  occurredAt: z.string().datetime({ offset: true }).optional(),
  metadata: z.record(z.unknown()).default({}),
});

export const sessionStartInput = z.object({
  title: z.string().min(2).max(200),
  sourceType: z.enum(sourceTypes),
  sourceName: z.string().min(1).max(120),
  actorType: z.enum(actorTypes),
  actorName: z.string().min(1).max(120),
  externalRefs: z.array(externalRefSchema).max(100).default([]),
  startedAt: z.string().datetime({ offset: true }).optional(),
  idempotencyKey: idempotencyKeySchema,
});

export const appendMessagesInput = z.object({
  expectedSequence: z.number().int().min(1),
  messages: z.array(messageInput).min(1).max(200),
  idempotencyKey: idempotencyKeySchema,
});

export const sessionCloseInput = z.object({
  action: z.enum(["close", "abandon"]).default("close"),
  records: z.array(recordCreateInput.omit({ sourceSessionId: true })).max(20).default([]),
  endedAt: z.string().datetime({ offset: true }).optional(),
  reason: z.string().max(2_000).optional(),
  idempotencyKey: idempotencyKeySchema,
}).superRefine((value, context) => {
  if (value.action === "close" && value.records.length === 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["records"], message: "A closed session requires at least one Record" });
  }
  if (value.action === "abandon" && !value.reason?.trim()) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["reason"], message: "An abandoned session requires a reason" });
  }
});

export const captureInput = z.object({
  schemaVersion: z.literal(CAPTURE_SCHEMA_VERSION).default(CAPTURE_SCHEMA_VERSION),
  idempotencyKey: idempotencyKeySchema,
  session: sessionStartInput.omit({ idempotencyKey: true }).extend({
    endedAt: z.string().datetime({ offset: true }).optional(),
    messages: z.array(messageInput).min(1).max(2_000),
  }),
  records: z.array(recordCreateInput.omit({ sourceSessionId: true })).min(1).max(20),
});

export const reviewInput = z.object({
  action: z.enum(["confirm", "dismiss", "retract"]),
  reviewer: z.string().min(1).max(120),
  attestation: z.literal("human_reviewed"),
  note: z.string().min(1).max(2_000),
  idempotencyKey: idempotencyKeySchema,
});

export const supersedeInput = z.object({
  reviewer: z.string().min(1).max(120),
  attestation: z.literal("human_reviewed"),
  reason: z.string().min(1).max(2_000),
  replacement: recordCreateInput,
  idempotencyKey: idempotencyKeySchema,
});

const optionalDate = z.string().datetime({ offset: true }).optional();

export const recordQuery = z.object({
  status: z.enum(recordStatuses).optional(),
  kind: z.enum(recordKinds).optional(),
  sourceName: z.string().max(120).optional(),
  actorName: z.string().max(120).optional(),
  q: z.string().max(500).optional(),
  from: optionalDate,
  to: optionalDate,
  cursor: z.string().max(1_000).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const sessionQuery = z.object({
  status: z.enum(sessionStatuses).optional(),
  q: z.string().max(500).optional(),
  cursor: z.string().max(1_000).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export type ProjectInput = z.infer<typeof projectInput>;
export type RecordCreateInput = z.infer<typeof recordCreateInput>;
export type MessageInput = z.infer<typeof messageInput>;
export type SessionStartInput = z.infer<typeof sessionStartInput>;
export type AppendMessagesInput = z.infer<typeof appendMessagesInput>;
export type SessionCloseInput = z.infer<typeof sessionCloseInput>;
export type CaptureInput = z.infer<typeof captureInput>;
export type ReviewInput = z.infer<typeof reviewInput>;
export type SupersedeInput = z.infer<typeof supersedeInput>;
export type RecordStatus = (typeof recordStatuses)[number];

export class OcturaError extends Error {
  constructor(readonly code: string, message: string, readonly status = 400, readonly details?: unknown) {
    super(message);
  }
}

const sensitivePatterns: Array<{ name: string; pattern: RegExp }> = [
  { name: "private_key", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i },
  { name: "openai_key", pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/ },
  { name: "github_token", pattern: /\bgh[oprsu]_[A-Za-z0-9]{20,}\b/ },
  { name: "aws_access_key", pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "assigned_secret", pattern: /\b(?:api[_-]?key|token|secret|password)\s*[:=]\s*["']?[A-Za-z0-9_./+=-]{16,}/i },
];

export function findSensitiveContent(value: string): string | null {
  return sensitivePatterns.find((entry) => entry.pattern.test(value))?.name ?? null;
}

export function assertSafeMessages(messages: MessageInput[]): void {
  let totalBytes = 0;
  for (const [index, message] of messages.entries()) {
    totalBytes += Buffer.byteLength(message.content, "utf8");
    const sensitive = findSensitiveContent(message.content);
    if (sensitive) {
      throw new OcturaError("sensitive_content", "对话包含疑似凭证，请脱敏后重试", 422, { messageIndex: index, pattern: sensitive });
    }
  }
  if (totalBytes > 10 * 1024 * 1024) {
    throw new OcturaError("session_too_large", "单个 Session 的消息总量不能超过 10 MiB", 413, { totalBytes });
  }
}

export function nextRecordStatus(current: RecordStatus, action: ReviewInput["action"]): RecordStatus {
  if (action === "confirm" && current === "captured") return "reviewed";
  if (action === "dismiss" && current === "captured") return "dismissed";
  if (action === "retract" && current === "reviewed") return "retracted";
  throw new OcturaError("invalid_state", `不能对 ${current} Record 执行 ${action}`, 409, { current, action });
}

export function encodeCursor(occurredAt: string, id: string): string {
  return Buffer.from(JSON.stringify({ occurredAt, id }), "utf8").toString("base64url");
}

export function decodeCursor(cursor: string): { occurredAt: string; id: string } {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as { occurredAt?: unknown; id?: unknown };
    if (typeof parsed.occurredAt !== "string" || typeof parsed.id !== "string") throw new Error("invalid cursor");
    return { occurredAt: parsed.occurredAt, id: parsed.id };
  } catch {
    throw new OcturaError("invalid_cursor", "分页 cursor 无效", 400);
  }
}

export const recordingPrompt = `你是项目的开发记录员。请把一次 AI 开发活动整理成离开原对话后仍能独立理解、定位和验证的 Octura Record。

规则：
1. 一条 Record 只描述一个连贯成果；无关成果拆分为多条。
2. 保留目标、约束、验收、结果、关键改动、决策、验证、风险、下一步和外部引用。
3. 验证状态只能是 passed、failed、not_run 或 unknown；没有实际运行就不得写 passed。
4. Agent 从 Session 总结出的内容使用 truth=derived；直接保存的原始证据才使用 truth=raw。
5. 不提交隐藏推理、思维链、密钥、个人敏感信息或大段原始工具日志。
6. 未完成时使用 partial 或 blocked，并明确缺口。
7. 输出必须符合 octura.record.v1 JSON Schema。`;

export const recordJsonSchema = {
  $id: RECORD_SCHEMA_VERSION,
  type: "object",
  required: ["kind", "title", "outcomeStatus", "intent", "result", "provenance", "idempotencyKey"],
  properties: {
    schemaVersion: { const: RECORD_SCHEMA_VERSION },
    kind: { enum: recordKinds },
    title: { type: "string", minLength: 2, maxLength: 160 },
    outcomeStatus: { enum: ["completed", "partial", "blocked"] },
    intent: { type: "object", required: ["goal"], properties: {
      goal: { type: "string" }, constraints: { type: "array", items: { type: "string" } }, acceptance: { type: "array", items: { type: "string" } },
    } },
    result: { type: "string", description: "Markdown supported" },
    changes: { type: "array", items: { type: "object", required: ["scope", "description"] } },
    decisions: { type: "array", items: { type: "object", required: ["decision", "rationale"] } },
    verification: { type: "array", items: { type: "object", required: ["name", "status"] } },
    risks: { type: "array", items: { type: "string" } },
    nextSteps: { type: "array", items: { type: "string" } },
    externalRefs: { type: "array", items: { type: "object", required: ["type", "value"] } },
    provenance: { type: "object", required: ["truth", "sourceType", "sourceName", "actorType", "actorName"] },
    occurredAt: { type: "string", format: "date-time" },
    idempotencyKey: { type: "string", minLength: 1, maxLength: 200 },
  },
} as const;

export const captureJsonSchema = {
  $id: CAPTURE_SCHEMA_VERSION,
  type: "object",
  required: ["idempotencyKey", "session", "records"],
  properties: {
    schemaVersion: { const: CAPTURE_SCHEMA_VERSION },
    idempotencyKey: { type: "string" },
    session: { type: "object", required: ["title", "sourceType", "sourceName", "actorType", "actorName", "messages"] },
    records: { type: "array", minItems: 1, maxItems: 20, items: { $ref: RECORD_SCHEMA_VERSION } },
  },
} as const;

export function getRecordingProtocol() {
  return { schemaVersion: RECORDING_PROMPT_VERSION, promptVersion: RECORDING_PROMPT_VERSION, prompt: recordingPrompt, recordSchema: recordJsonSchema, captureSchema: captureJsonSchema };
}

export function formatKind(kind: string): string {
  return kind.charAt(0).toUpperCase() + kind.slice(1).replaceAll("_", " ");
}
