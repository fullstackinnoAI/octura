import { randomUUID } from "node:crypto";
import type postgres from "postgres";
import { sql } from "./db.js";
import type { ProjectInput, RecordInput } from "./domain.js";

export type ProjectRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
};

export type RecordRow = {
  id: string;
  projectId: string;
  kind: string;
  title: string;
  body: string;
  source: string;
  actor: string;
  externalRef: string | null;
  truth: "raw" | "derived";
  status: "captured" | "reviewed";
  metadata: Record<string, unknown>;
  occurredAt: string;
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewNote: string | null;
};

const projectColumns = sql`
  id, slug, name, description,
  created_at AS "createdAt", updated_at AS "updatedAt"
`;

const recordColumns = sql`
  id, project_id AS "projectId", kind, title, body, source, actor,
  external_ref AS "externalRef", truth, status, metadata,
  occurred_at AS "occurredAt", created_at AS "createdAt",
  reviewed_at AS "reviewedAt", reviewed_by AS "reviewedBy", review_note AS "reviewNote"
`;

export async function upsertProject(input: ProjectInput): Promise<ProjectRow> {
  const [project] = await sql<ProjectRow[]>`
    INSERT INTO projects (id, slug, name, description)
    VALUES (${randomUUID()}, ${input.slug}, ${input.name}, ${input.description})
    ON CONFLICT (slug) DO UPDATE
      SET name = EXCLUDED.name, description = EXCLUDED.description, updated_at = now()
    RETURNING ${projectColumns}
  `;
  return project!;
}

export async function listProjects(): Promise<ProjectRow[]> {
  return sql<ProjectRow[]>`
    SELECT ${projectColumns}
    FROM projects
    ORDER BY updated_at DESC, created_at DESC
  `;
}

export async function getProject(slug: string): Promise<ProjectRow | null> {
  const [project] = await sql<ProjectRow[]>`
    SELECT ${projectColumns}
    FROM projects
    WHERE slug = ${slug}
  `;
  return project ?? null;
}

export async function createRecord(projectId: string, input: RecordInput): Promise<RecordRow> {
  const [record] = await sql<RecordRow[]>`
    INSERT INTO records (
      id, project_id, kind, title, body, source, actor, external_ref,
      truth, metadata, idempotency_key, occurred_at
    )
    VALUES (
      ${randomUUID()}, ${projectId}, ${input.kind}, ${input.title}, ${input.body},
      ${input.source}, ${input.actor}, ${input.externalRef ?? null}, ${input.truth},
      ${sql.json(input.metadata as postgres.JSONValue)}, ${input.idempotencyKey ?? null}, ${input.occurredAt ?? new Date().toISOString()}
    )
    ON CONFLICT (project_id, idempotency_key) DO UPDATE
      SET idempotency_key = records.idempotency_key
    RETURNING ${recordColumns}
  `;
  return record!;
}

export async function listRecords(
  projectId: string,
  filters: { status?: string; kind?: string; source?: string; limit: number },
): Promise<RecordRow[]> {
  return sql<RecordRow[]>`
    SELECT ${recordColumns}
    FROM records
    WHERE project_id = ${projectId}
      ${filters.status ? sql`AND status = ${filters.status}` : sql``}
      ${filters.kind ? sql`AND kind = ${filters.kind}` : sql``}
      ${filters.source ? sql`AND source = ${filters.source}` : sql``}
    ORDER BY occurred_at DESC, created_at DESC
    LIMIT ${filters.limit}
  `;
}

export async function reviewRecord(
  projectId: string,
  recordId: string,
  input: { actor: string; note: string },
): Promise<RecordRow | null> {
  const [record] = await sql<RecordRow[]>`
    UPDATE records
    SET status = 'reviewed', reviewed_at = now(), reviewed_by = ${input.actor}, review_note = ${input.note}
    WHERE id = ${recordId} AND project_id = ${projectId}
    RETURNING ${recordColumns}
  `;
  return record ?? null;
}

export async function getProjectSummary(projectId: string) {
  const [totals] = await sql<
    { total: number; reviewed: number; captured: number; sources: number }[]
  >`
    SELECT
      count(*)::int AS total,
      count(*) FILTER (WHERE status = 'reviewed')::int AS reviewed,
      count(*) FILTER (WHERE status = 'captured')::int AS captured,
      count(DISTINCT source)::int AS sources
    FROM records
    WHERE project_id = ${projectId}
  `;

  const kinds = await sql<{ kind: string; count: number }[]>`
    SELECT kind, count(*)::int AS count
    FROM records
    WHERE project_id = ${projectId}
    GROUP BY kind
    ORDER BY kind
  `;

  const requiredKinds = ["conversation", "requirement", "decision", "code", "test"];
  const existingKinds = new Set(kinds.map((item) => item.kind));
  const coverage = Math.round((requiredKinds.filter((kind) => existingKinds.has(kind)).length / requiredKinds.length) * 100);

  return {
    ...(totals ?? { total: 0, reviewed: 0, captured: 0, sources: 0 }),
    coverage,
    kinds,
    requiredKinds,
  };
}
