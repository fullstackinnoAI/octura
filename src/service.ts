import { createHash, randomUUID } from "node:crypto";
import type postgres from "postgres";
import { sql } from "./db.js";
import {
  OcturaError,
  assertSafeMessages,
  decodeCursor,
  encodeCursor,
  findSensitiveContent,
  nextRecordStatus,
  type AppendMessagesInput,
  type CaptureInput,
  type MessageInput,
  type ProjectInput,
  type RecordCreateInput,
  type RecordStatus,
  type ReviewInput,
  type SessionCloseInput,
  type SessionStartInput,
  type SupersedeInput,
} from "./domain.js";

export type Surface = "web" | "cli" | "api" | "mcp";

export type ProjectRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
};

export type SessionRow = {
  id: string;
  projectId: string;
  title: string;
  sourceType: string;
  sourceName: string;
  actorType: string;
  actorName: string;
  externalRefs: Array<Record<string, unknown>>;
  status: "open" | "closed" | "abandoned";
  captureMode: "batch" | "realtime";
  startedAt: string;
  endedAt: string | null;
  abandonReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MessageRow = {
  id: string;
  sessionId: string;
  sequence: number;
  role: string;
  content: string;
  actorName: string | null;
  metadata: Record<string, unknown>;
  occurredAt: string;
  createdAt: string;
};

export type RecordRow = {
  id: string;
  projectId: string;
  sourceSessionId: string | null;
  schemaVersion: string;
  kind: string;
  title: string;
  outcomeStatus: "completed" | "partial" | "blocked";
  intent: { goal: string; constraints: string[]; acceptance: string[] };
  result: string;
  changes: Array<{ scope: string; description: string }>;
  decisions: Array<{ decision: string; rationale: string }>;
  verification: Array<{ name: string; status: string; details?: string; ref?: string }>;
  risks: string[];
  nextSteps: string[];
  externalRefs: Array<{ type: string; value: string; label?: string }>;
  provenance: { truth: string; sourceType: string; sourceName: string; actorType: string; actorName: string };
  status: RecordStatus;
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
};

type ReviewEventRow = {
  id: string;
  recordId: string;
  action: string;
  fromStatus: string;
  toStatus: string;
  reviewer: string;
  attestation: string;
  note: string;
  surface: string;
  identityAssurance: string;
  createdAt: string;
};

type IdempotentResult<T> = { data: T; idempotentReplay: boolean };

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, stableValue(item)]));
  }
  return value;
}

function requestHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(stableValue(value))).digest("hex");
}

function jsonValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function idempotent<T>(
  projectId: string,
  operation: string,
  key: string,
  request: unknown,
  work: (transaction: postgres.TransactionSql) => Promise<T>,
): Promise<IdempotentResult<T>> {
  const hash = requestHash(request);
  return sql.begin(async (transaction) => {
    await transaction`SELECT pg_advisory_xact_lock(hashtext(${`${projectId}:${operation}:${key}`}))`;
    const [receipt] = await transaction<{ requestHash: string; response: T }[]>`
      SELECT request_hash AS "requestHash", response
      FROM idempotency_receipts
      WHERE project_id = ${projectId} AND operation = ${operation} AND idempotency_key = ${key}
    `;
    if (receipt) {
      if (receipt.requestHash !== hash) {
        throw new OcturaError("idempotency_conflict", "相同幂等键已用于不同请求", 409, { operation, idempotencyKey: key });
      }
      return { data: receipt.response, idempotentReplay: true };
    }

    const data = await work(transaction);
    const stored = jsonValue(data);
    await transaction`
      INSERT INTO idempotency_receipts (id, project_id, operation, idempotency_key, request_hash, response)
      VALUES (${randomUUID()}, ${projectId}, ${operation}, ${key}, ${hash}, ${transaction.json(stored as postgres.JSONValue)})
    `;
    return { data, idempotentReplay: false };
  });
}

function assertSafeRecord(input: RecordCreateInput): void {
  const combined = [
    input.title,
    input.intent.goal,
    ...input.intent.constraints,
    ...input.intent.acceptance,
    input.result,
    ...input.changes.flatMap((item) => [item.scope, item.description]),
    ...input.decisions.flatMap((item) => [item.decision, item.rationale]),
    ...input.verification.flatMap((item) => [item.name, item.details ?? "", item.ref ?? ""]),
    ...input.risks,
    ...input.nextSteps,
  ].join("\n");
  const sensitive = findSensitiveContent(combined);
  if (sensitive) throw new OcturaError("sensitive_content", "Record 包含疑似凭证，请脱敏后重试", 422, { pattern: sensitive });
}

function searchableText(input: RecordCreateInput): string {
  return [
    input.title,
    input.intent.goal,
    ...input.intent.constraints,
    ...input.intent.acceptance,
    input.result,
    ...input.changes.flatMap((item) => [item.scope, item.description]),
    ...input.decisions.flatMap((item) => [item.decision, item.rationale]),
    ...input.verification.flatMap((item) => [item.name, item.details ?? "", item.ref ?? ""]),
    ...input.risks,
    ...input.nextSteps,
    ...input.externalRefs.map((item) => `${item.label ?? ""} ${item.value}`),
  ].join(" ");
}

async function projectOrThrow(slug: string, transaction: typeof sql | postgres.TransactionSql = sql): Promise<ProjectRow> {
  const [project] = await transaction<ProjectRow[]>`
    SELECT id, slug, name, description, created_at AS "createdAt", updated_at AS "updatedAt"
    FROM projects WHERE slug = ${slug}
  `;
  if (!project) throw new OcturaError("project_not_found", "未找到项目", 404, { slug });
  return project;
}

async function recordOrThrow(projectId: string, id: string, transaction: typeof sql | postgres.TransactionSql = sql): Promise<RecordRow> {
  const [record] = await transaction<RecordRow[]>`
    SELECT id, project_id AS "projectId", source_session_id AS "sourceSessionId", schema_version AS "schemaVersion",
      kind, title, outcome_status AS "outcomeStatus", intent, result, changes, decisions, verification, risks,
      next_steps AS "nextSteps", external_refs AS "externalRefs", provenance, status,
      occurred_at AS "occurredAt", created_at AS "createdAt", updated_at AS "updatedAt"
    FROM records WHERE project_id = ${projectId} AND id = ${id}
  `;
  if (!record) throw new OcturaError("record_not_found", "未找到 Record", 404, { id });
  return record;
}

async function sessionOrThrow(projectId: string, id: string, transaction: typeof sql | postgres.TransactionSql = sql): Promise<SessionRow> {
  const [session] = await transaction<SessionRow[]>`
    SELECT id, project_id AS "projectId", title, source_type AS "sourceType", source_name AS "sourceName",
      actor_type AS "actorType", actor_name AS "actorName", external_refs AS "externalRefs", status,
      capture_mode AS "captureMode", started_at AS "startedAt", ended_at AS "endedAt",
      abandon_reason AS "abandonReason", created_at AS "createdAt", updated_at AS "updatedAt"
    FROM sessions WHERE project_id = ${projectId} AND id = ${id}
  `;
  if (!session) throw new OcturaError("session_not_found", "未找到 Session", 404, { id });
  return session;
}

async function insertRecord(
  transaction: postgres.TransactionSql,
  projectId: string,
  input: RecordCreateInput,
  sourceSessionId?: string,
): Promise<RecordRow> {
  assertSafeRecord(input);
  const existing = await transaction<{ id: string }[]>`
    SELECT id FROM records WHERE project_id = ${projectId} AND idempotency_key = ${input.idempotencyKey}
  `;
  if (existing[0]) {
    throw new OcturaError("idempotency_conflict", "Record 幂等键已经存在", 409, { idempotencyKey: input.idempotencyKey, recordId: existing[0].id });
  }

  const firstRef = input.externalRefs[0]?.value ?? null;
  const [record] = await transaction<RecordRow[]>`
    INSERT INTO records (
      id, project_id, source_session_id, schema_version, kind, title, outcome_status, intent, result, changes,
      decisions, verification, risks, next_steps, external_refs, provenance, status, search_text, idempotency_key,
      occurred_at, body, source, actor, external_ref, truth, metadata, updated_at
    ) VALUES (
      ${randomUUID()}, ${projectId}, ${sourceSessionId ?? input.sourceSessionId ?? null}, ${input.schemaVersion},
      ${input.kind}, ${input.title}, ${input.outcomeStatus}, ${transaction.json(input.intent as postgres.JSONValue)},
      ${input.result}, ${transaction.json(input.changes as postgres.JSONValue)}, ${transaction.json(input.decisions as postgres.JSONValue)},
      ${transaction.json(input.verification as postgres.JSONValue)}, ${transaction.json(input.risks as postgres.JSONValue)},
      ${transaction.json(input.nextSteps as postgres.JSONValue)}, ${transaction.json(input.externalRefs as postgres.JSONValue)},
      ${transaction.json(input.provenance as postgres.JSONValue)}, 'captured', ${searchableText(input)}, ${input.idempotencyKey},
      ${input.occurredAt ?? new Date().toISOString()}, ${input.result}, ${input.provenance.sourceName}, ${input.provenance.actorName}, ${firstRef},
      ${input.provenance.truth}, '{}'::jsonb, now()
    )
    RETURNING id, project_id AS "projectId", source_session_id AS "sourceSessionId", schema_version AS "schemaVersion",
      kind, title, outcome_status AS "outcomeStatus", intent, result, changes, decisions, verification, risks,
      next_steps AS "nextSteps", external_refs AS "externalRefs", provenance, status,
      occurred_at AS "occurredAt", created_at AS "createdAt", updated_at AS "updatedAt"
  `;
  return record!;
}

async function insertMessages(transaction: postgres.TransactionSql, sessionId: string, firstSequence: number, messages: MessageInput[]) {
  assertSafeMessages(messages);
  const rows: MessageRow[] = [];
  for (const [offset, message] of messages.entries()) {
    const [row] = await transaction<MessageRow[]>`
      INSERT INTO session_messages (id, session_id, sequence, role, content, actor_name, metadata, occurred_at)
      VALUES (${randomUUID()}, ${sessionId}, ${firstSequence + offset}, ${message.role}, ${message.content},
        ${message.actorName ?? null}, ${transaction.json(message.metadata as postgres.JSONValue)}, ${message.occurredAt ?? new Date().toISOString()})
      RETURNING id, session_id AS "sessionId", sequence, role, content, actor_name AS "actorName", metadata,
        occurred_at AS "occurredAt", created_at AS "createdAt"
    `;
    rows.push(row!);
  }
  return rows;
}

export async function upsertProject(input: ProjectInput): Promise<ProjectRow> {
  const [project] = await sql<ProjectRow[]>`
    INSERT INTO projects (id, slug, name, description)
    VALUES (${randomUUID()}, ${input.slug}, ${input.name}, ${input.description})
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, updated_at = now()
    RETURNING id, slug, name, description, created_at AS "createdAt", updated_at AS "updatedAt"
  `;
  return project!;
}

export async function listProjects(): Promise<ProjectRow[]> {
  return sql<ProjectRow[]>`
    SELECT id, slug, name, description, created_at AS "createdAt", updated_at AS "updatedAt"
    FROM projects ORDER BY updated_at DESC, created_at DESC
  `;
}

export async function getProject(slug: string): Promise<ProjectRow> {
  return projectOrThrow(slug);
}

export async function createRecord(slug: string, input: RecordCreateInput): Promise<IdempotentResult<RecordRow>> {
  const project = await projectOrThrow(slug);
  return idempotent(project.id, "record.create", input.idempotencyKey, input, (transaction) => insertRecord(transaction, project.id, input));
}

export async function startSession(slug: string, input: SessionStartInput): Promise<IdempotentResult<SessionRow>> {
  const project = await projectOrThrow(slug);
  return idempotent(project.id, "session.start", input.idempotencyKey, input, async (transaction) => {
    const [session] = await transaction<SessionRow[]>`
      INSERT INTO sessions (id, project_id, title, source_type, source_name, actor_type, actor_name, external_refs, status, capture_mode, started_at, idempotency_key)
      VALUES (${randomUUID()}, ${project.id}, ${input.title}, ${input.sourceType}, ${input.sourceName}, ${input.actorType},
        ${input.actorName}, ${transaction.json(input.externalRefs as postgres.JSONValue)}, 'open', 'realtime', ${input.startedAt ?? new Date().toISOString()}, ${input.idempotencyKey})
      RETURNING id, project_id AS "projectId", title, source_type AS "sourceType", source_name AS "sourceName",
        actor_type AS "actorType", actor_name AS "actorName", external_refs AS "externalRefs", status,
        capture_mode AS "captureMode", started_at AS "startedAt", ended_at AS "endedAt", abandon_reason AS "abandonReason",
        created_at AS "createdAt", updated_at AS "updatedAt"
    `;
    return session!;
  });
}

export async function appendMessages(slug: string, sessionId: string, input: AppendMessagesInput): Promise<IdempotentResult<{ session: SessionRow; messages: MessageRow[]; nextSequence: number }>> {
  const project = await projectOrThrow(slug);
  return idempotent(project.id, `session.append:${sessionId}`, input.idempotencyKey, input, async (transaction) => {
    const session = await sessionOrThrow(project.id, sessionId, transaction);
    if (session.status !== "open") throw new OcturaError("session_closed", "关闭后的 Session 不能继续追加消息", 409, { status: session.status });
    const [sequence] = await transaction<{ nextSequence: number }[]>`
      SELECT coalesce(max(sequence), 0)::int + 1 AS "nextSequence" FROM session_messages WHERE session_id = ${sessionId}
    `;
    const next = sequence?.nextSequence ?? 1;
    if (next !== input.expectedSequence) {
      throw new OcturaError("sequence_conflict", "消息序号与服务端不一致", 409, { expected: input.expectedSequence, actual: next });
    }
    const messages = await insertMessages(transaction, sessionId, next, input.messages);
    return { session, messages, nextSequence: next + messages.length };
  });
}

export async function closeSession(slug: string, sessionId: string, input: SessionCloseInput): Promise<IdempotentResult<{ session: SessionRow; records: RecordRow[] }>> {
  const project = await projectOrThrow(slug);
  return idempotent(project.id, `session.close:${sessionId}`, input.idempotencyKey, input, async (transaction) => {
    const session = await sessionOrThrow(project.id, sessionId, transaction);
    if (session.status !== "open") throw new OcturaError("invalid_state", "Session 已经结束", 409, { status: session.status });
    const records: RecordRow[] = [];
    if (input.action === "close") {
      for (const record of input.records) records.push(await insertRecord(transaction, project.id, record, sessionId));
    }
    const status = input.action === "close" ? "closed" : "abandoned";
    const [updated] = await transaction<SessionRow[]>`
      UPDATE sessions SET status = ${status}, ended_at = ${input.endedAt ?? new Date().toISOString()}, abandon_reason = ${input.reason ?? null}, updated_at = now()
      WHERE id = ${sessionId}
      RETURNING id, project_id AS "projectId", title, source_type AS "sourceType", source_name AS "sourceName",
        actor_type AS "actorType", actor_name AS "actorName", external_refs AS "externalRefs", status,
        capture_mode AS "captureMode", started_at AS "startedAt", ended_at AS "endedAt", abandon_reason AS "abandonReason",
        created_at AS "createdAt", updated_at AS "updatedAt"
    `;
    return { session: updated!, records };
  });
}

export async function captureActivity(slug: string, input: CaptureInput): Promise<IdempotentResult<{ session: SessionRow; messages: MessageRow[]; records: RecordRow[] }>> {
  const project = await projectOrThrow(slug);
  assertSafeMessages(input.session.messages);
  return idempotent(project.id, "capture.create", input.idempotencyKey, input, async (transaction) => {
    const sessionId = randomUUID();
    const [session] = await transaction<SessionRow[]>`
      INSERT INTO sessions (id, project_id, title, source_type, source_name, actor_type, actor_name, external_refs, status, capture_mode, started_at, ended_at, idempotency_key)
      VALUES (${sessionId}, ${project.id}, ${input.session.title}, ${input.session.sourceType}, ${input.session.sourceName},
        ${input.session.actorType}, ${input.session.actorName}, ${transaction.json(input.session.externalRefs as postgres.JSONValue)},
        'closed', 'batch', ${input.session.startedAt ?? new Date().toISOString()}, ${input.session.endedAt ?? new Date().toISOString()}, ${input.idempotencyKey})
      RETURNING id, project_id AS "projectId", title, source_type AS "sourceType", source_name AS "sourceName",
        actor_type AS "actorType", actor_name AS "actorName", external_refs AS "externalRefs", status,
        capture_mode AS "captureMode", started_at AS "startedAt", ended_at AS "endedAt", abandon_reason AS "abandonReason",
        created_at AS "createdAt", updated_at AS "updatedAt"
    `;
    const messages = await insertMessages(transaction, sessionId, 1, input.session.messages);
    const records: RecordRow[] = [];
    for (const record of input.records) records.push(await insertRecord(transaction, project.id, record, sessionId));
    return { session: session!, messages, records };
  });
}

export async function reviewRecord(slug: string, recordId: string, input: ReviewInput, surface: Surface): Promise<IdempotentResult<{ record: RecordRow; event: ReviewEventRow }>> {
  const project = await projectOrThrow(slug);
  return idempotent(project.id, `record.review:${recordId}`, input.idempotencyKey, input, async (transaction) => {
    const record = await recordOrThrow(project.id, recordId, transaction);
    const toStatus = nextRecordStatus(record.status, input.action);
    const [event] = await transaction<ReviewEventRow[]>`
      INSERT INTO review_events (id, project_id, record_id, action, from_status, to_status, reviewer, attestation, note, surface, idempotency_key)
      VALUES (${randomUUID()}, ${project.id}, ${recordId}, ${input.action}, ${record.status}, ${toStatus}, ${input.reviewer},
        ${input.attestation}, ${input.note}, ${surface}, ${input.idempotencyKey})
      RETURNING id, record_id AS "recordId", action, from_status AS "fromStatus", to_status AS "toStatus", reviewer,
        attestation, note, surface, identity_assurance AS "identityAssurance", created_at AS "createdAt"
    `;
    await transaction`UPDATE records SET status = ${toStatus}, updated_at = now() WHERE id = ${recordId}`;
    return { record: await recordOrThrow(project.id, recordId, transaction), event: event! };
  });
}

export async function supersedeRecord(slug: string, recordId: string, input: SupersedeInput, surface: Surface): Promise<IdempotentResult<{ predecessor: RecordRow; replacement: RecordRow }>> {
  const project = await projectOrThrow(slug);
  return idempotent(project.id, `record.supersede:${recordId}`, input.idempotencyKey, input, async (transaction) => {
    const predecessor = await recordOrThrow(project.id, recordId, transaction);
    if (!(["captured", "reviewed"] as RecordStatus[]).includes(predecessor.status)) {
      throw new OcturaError("invalid_state", "只有 captured 或 reviewed Record 可以被取代", 409, { status: predecessor.status });
    }
    const replacement = await insertRecord(transaction, project.id, input.replacement, input.replacement.sourceSessionId);
    await transaction`
      INSERT INTO record_supersessions (id, project_id, predecessor_id, replacement_id, reviewer, attestation, reason, surface, idempotency_key)
      VALUES (${randomUUID()}, ${project.id}, ${recordId}, ${replacement.id}, ${input.reviewer}, ${input.attestation},
        ${input.reason}, ${surface}, ${input.idempotencyKey})
    `;
    await transaction`UPDATE records SET status = 'superseded', updated_at = now() WHERE id = ${recordId}`;
    return { predecessor: await recordOrThrow(project.id, recordId, transaction), replacement };
  });
}

export async function listRecords(slug: string, filters: {
  status?: RecordStatus; kind?: string; sourceName?: string; actorName?: string; q?: string; from?: string; to?: string; cursor?: string; limit: number;
}) {
  const project = await projectOrThrow(slug);
  const cursor = filters.cursor ? decodeCursor(filters.cursor) : undefined;
  const rows = await sql<RecordRow[]>`
    SELECT id, project_id AS "projectId", source_session_id AS "sourceSessionId", schema_version AS "schemaVersion",
      kind, title, outcome_status AS "outcomeStatus", intent, result, changes, decisions, verification, risks,
      next_steps AS "nextSteps", external_refs AS "externalRefs", provenance, status,
      occurred_at AS "occurredAt", created_at AS "createdAt", updated_at AS "updatedAt"
    FROM records
    WHERE project_id = ${project.id}
      ${filters.status ? sql`AND status = ${filters.status}` : sql``}
      ${filters.kind ? sql`AND kind = ${filters.kind}` : sql``}
      ${filters.sourceName ? sql`AND provenance->>'sourceName' = ${filters.sourceName}` : sql``}
      ${filters.actorName ? sql`AND provenance->>'actorName' = ${filters.actorName}` : sql``}
      ${filters.q ? sql`AND search_text ILIKE ${`%${filters.q}%`}` : sql``}
      ${filters.from ? sql`AND occurred_at >= ${filters.from}` : sql``}
      ${filters.to ? sql`AND occurred_at <= ${filters.to}` : sql``}
      ${cursor ? sql`AND (occurred_at < ${cursor.occurredAt} OR (occurred_at = ${cursor.occurredAt} AND id::text < ${cursor.id}))` : sql``}
    ORDER BY occurred_at DESC, id DESC
    LIMIT ${filters.limit + 1}
  `;
  const hasMore = rows.length > filters.limit;
  const items = hasMore ? rows.slice(0, filters.limit) : rows;
  const last = items.at(-1);
  return { project, items, nextCursor: hasMore && last ? encodeCursor(last.occurredAt, last.id) : null };
}

export async function getRecordDetail(slug: string, recordId: string) {
  const project = await projectOrThrow(slug);
  const record = await recordOrThrow(project.id, recordId);
  const [reviews, supersession, supersededBy] = await Promise.all([
    sql<ReviewEventRow[]>`
      SELECT id, record_id AS "recordId", action, from_status AS "fromStatus", to_status AS "toStatus", reviewer,
        attestation, note, surface, identity_assurance AS "identityAssurance", created_at AS "createdAt"
      FROM review_events WHERE record_id = ${recordId} ORDER BY created_at ASC
    `,
    sql<{ id: string; reason: string; reviewer: string; replacementId: string; createdAt: string }[]>`
      SELECT id, reason, reviewer, replacement_id AS "replacementId", created_at AS "createdAt"
      FROM record_supersessions WHERE predecessor_id = ${recordId}
    `,
    sql<{ id: string; reason: string; reviewer: string; predecessorId: string; createdAt: string }[]>`
      SELECT id, reason, reviewer, predecessor_id AS "predecessorId", created_at AS "createdAt"
      FROM record_supersessions WHERE replacement_id = ${recordId}
    `,
  ]);
  return { project, record, reviews, supersession: supersession[0] ?? null, supersededBy: supersededBy[0] ?? null };
}

export async function listSessions(slug: string, filters: { status?: string; q?: string; cursor?: string; limit: number }) {
  const project = await projectOrThrow(slug);
  const cursor = filters.cursor ? decodeCursor(filters.cursor) : undefined;
  const rows = await sql<Array<SessionRow & { messageCount: number; recordCount: number }>>`
    SELECT s.id, s.project_id AS "projectId", s.title, s.source_type AS "sourceType", s.source_name AS "sourceName",
      s.actor_type AS "actorType", s.actor_name AS "actorName", s.external_refs AS "externalRefs", s.status,
      s.capture_mode AS "captureMode", s.started_at AS "startedAt", s.ended_at AS "endedAt", s.abandon_reason AS "abandonReason",
      s.created_at AS "createdAt", s.updated_at AS "updatedAt", count(DISTINCT m.id)::int AS "messageCount", count(DISTINCT r.id)::int AS "recordCount"
    FROM sessions s
    LEFT JOIN session_messages m ON m.session_id = s.id
    LEFT JOIN records r ON r.source_session_id = s.id
    WHERE s.project_id = ${project.id}
      ${filters.status ? sql`AND s.status = ${filters.status}` : sql``}
      ${filters.q ? sql`AND (s.title ILIKE ${`%${filters.q}%`} OR s.source_name ILIKE ${`%${filters.q}%`})` : sql``}
      ${cursor ? sql`AND (s.started_at < ${cursor.occurredAt} OR (s.started_at = ${cursor.occurredAt} AND s.id::text < ${cursor.id}))` : sql``}
    GROUP BY s.id
    ORDER BY s.started_at DESC, s.id DESC
    LIMIT ${filters.limit + 1}
  `;
  const hasMore = rows.length > filters.limit;
  const items = hasMore ? rows.slice(0, filters.limit) : rows;
  const last = items.at(-1);
  return { project, items, nextCursor: hasMore && last ? encodeCursor(last.startedAt, last.id) : null };
}

export async function getSessionDetail(slug: string, sessionId: string) {
  const project = await projectOrThrow(slug);
  const session = await sessionOrThrow(project.id, sessionId);
  const [messages, records] = await Promise.all([
    sql<MessageRow[]>`
      SELECT id, session_id AS "sessionId", sequence, role, content, actor_name AS "actorName", metadata,
        occurred_at AS "occurredAt", created_at AS "createdAt"
      FROM session_messages WHERE session_id = ${sessionId} ORDER BY sequence ASC
    `,
    sql<RecordRow[]>`
      SELECT id, project_id AS "projectId", source_session_id AS "sourceSessionId", schema_version AS "schemaVersion",
        kind, title, outcome_status AS "outcomeStatus", intent, result, changes, decisions, verification, risks,
        next_steps AS "nextSteps", external_refs AS "externalRefs", provenance, status,
        occurred_at AS "occurredAt", created_at AS "createdAt", updated_at AS "updatedAt"
      FROM records WHERE source_session_id = ${sessionId} ORDER BY occurred_at ASC
    `,
  ]);
  return { project, session, messages, records };
}

export async function getDashboard(slug: string) {
  const project = await projectOrThrow(slug);
  const [summary, kindRows, recent] = await Promise.all([
    sql<Array<{ total: number; captured: number; reviewed: number; dismissed: number; retracted: number; superseded: number; sessions: number; sources: number }>>`
      SELECT count(*)::int AS total,
        count(*) FILTER (WHERE status = 'captured')::int AS captured,
        count(*) FILTER (WHERE status = 'reviewed')::int AS reviewed,
        count(*) FILTER (WHERE status = 'dismissed')::int AS dismissed,
        count(*) FILTER (WHERE status = 'retracted')::int AS retracted,
        count(*) FILTER (WHERE status = 'superseded')::int AS superseded,
        (SELECT count(*)::int FROM sessions WHERE project_id = ${project.id}) AS sessions,
        count(DISTINCT provenance->>'sourceName')::int AS sources
      FROM records WHERE project_id = ${project.id}
    `,
    sql<Array<{ kind: string; count: number }>>`
      SELECT kind, count(*)::int AS count FROM records WHERE project_id = ${project.id} GROUP BY kind ORDER BY kind
    `,
    listRecords(slug, { limit: 50 }),
  ]);
  return { project, summary: { ...(summary[0] ?? { total: 0, captured: 0, reviewed: 0, dismissed: 0, retracted: 0, superseded: 0, sessions: 0, sources: 0 }), kinds: kindRows }, records: recent.items };
}
