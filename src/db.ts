import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL ?? "postgresql://octura:octura@localhost:5432/octura";

export const sql = postgres(databaseUrl, {
  max: Number(process.env.DB_POOL_SIZE ?? 10),
  idle_timeout: 20,
  connect_timeout: 10,
  onnotice: () => undefined,
});

const migrations = [
  {
    id: "001_initial",
    sql: `
      CREATE TABLE IF NOT EXISTS projects (
        id uuid PRIMARY KEY,
        slug text NOT NULL UNIQUE,
        name text NOT NULL,
        description text NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS records (
        id uuid PRIMARY KEY,
        project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        kind text NOT NULL CHECK (kind IN ('conversation', 'requirement', 'decision', 'code', 'test', 'verification', 'release')),
        title text NOT NULL,
        body text NOT NULL,
        source text NOT NULL,
        actor text NOT NULL,
        external_ref text,
        truth text NOT NULL DEFAULT 'raw' CHECK (truth IN ('raw', 'derived')),
        status text NOT NULL DEFAULT 'captured' CHECK (status IN ('captured', 'reviewed')),
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        idempotency_key text,
        occurred_at timestamptz NOT NULL DEFAULT now(),
        created_at timestamptz NOT NULL DEFAULT now(),
        reviewed_at timestamptz,
        reviewed_by text,
        review_note text,
        UNIQUE(project_id, idempotency_key)
      );

      CREATE INDEX IF NOT EXISTS records_project_occurred_idx ON records(project_id, occurred_at DESC);
      CREATE INDEX IF NOT EXISTS records_project_status_idx ON records(project_id, status);
    `,
  },
  {
    id: "002_recording_v1",
    sql: `
      CREATE EXTENSION IF NOT EXISTS pg_trgm;

      CREATE TABLE IF NOT EXISTS sessions (
        id uuid PRIMARY KEY,
        project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        title text NOT NULL,
        source_type text NOT NULL CHECK (source_type IN ('human', 'agent', 'git', 'ci', 'import', 'other')),
        source_name text NOT NULL,
        actor_type text NOT NULL CHECK (actor_type IN ('human', 'agent', 'system')),
        actor_name text NOT NULL,
        external_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
        status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'abandoned')),
        capture_mode text NOT NULL DEFAULT 'realtime' CHECK (capture_mode IN ('batch', 'realtime')),
        started_at timestamptz NOT NULL,
        ended_at timestamptz,
        abandon_reason text,
        idempotency_key text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(project_id, idempotency_key)
      );

      CREATE TABLE IF NOT EXISTS session_messages (
        id uuid PRIMARY KEY,
        session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        sequence integer NOT NULL,
        role text NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
        content text NOT NULL,
        actor_name text,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        occurred_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(session_id, sequence)
      );

      ALTER TABLE records DROP CONSTRAINT IF EXISTS records_kind_check;
      ALTER TABLE records DROP CONSTRAINT IF EXISTS records_status_check;
      UPDATE records SET kind = 'summary' WHERE kind = 'conversation';
      UPDATE records SET kind = 'change' WHERE kind = 'code';
      ALTER TABLE records ADD CONSTRAINT records_kind_v1_check CHECK (kind IN ('summary', 'requirement', 'decision', 'change', 'test', 'verification', 'release'));
      ALTER TABLE records ADD CONSTRAINT records_status_v1_check CHECK (status IN ('captured', 'reviewed', 'dismissed', 'retracted', 'superseded'));
      ALTER TABLE records ADD COLUMN IF NOT EXISTS schema_version text NOT NULL DEFAULT 'octura.record.v1';
      ALTER TABLE records ADD COLUMN IF NOT EXISTS source_session_id uuid REFERENCES sessions(id) ON DELETE SET NULL;
      ALTER TABLE records ADD COLUMN IF NOT EXISTS outcome_status text NOT NULL DEFAULT 'completed' CHECK (outcome_status IN ('completed', 'partial', 'blocked'));
      ALTER TABLE records ADD COLUMN IF NOT EXISTS intent jsonb NOT NULL DEFAULT '{"goal":"","constraints":[],"acceptance":[]}'::jsonb;
      ALTER TABLE records ADD COLUMN IF NOT EXISTS result text NOT NULL DEFAULT '';
      ALTER TABLE records ADD COLUMN IF NOT EXISTS changes jsonb NOT NULL DEFAULT '[]'::jsonb;
      ALTER TABLE records ADD COLUMN IF NOT EXISTS decisions jsonb NOT NULL DEFAULT '[]'::jsonb;
      ALTER TABLE records ADD COLUMN IF NOT EXISTS verification jsonb NOT NULL DEFAULT '[]'::jsonb;
      ALTER TABLE records ADD COLUMN IF NOT EXISTS risks jsonb NOT NULL DEFAULT '[]'::jsonb;
      ALTER TABLE records ADD COLUMN IF NOT EXISTS next_steps jsonb NOT NULL DEFAULT '[]'::jsonb;
      ALTER TABLE records ADD COLUMN IF NOT EXISTS external_refs jsonb NOT NULL DEFAULT '[]'::jsonb;
      ALTER TABLE records ADD COLUMN IF NOT EXISTS provenance jsonb NOT NULL DEFAULT '{}'::jsonb;
      ALTER TABLE records ADD COLUMN IF NOT EXISTS search_text text NOT NULL DEFAULT '';
      ALTER TABLE records ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

      UPDATE records SET
        result = CASE WHEN result = '' THEN body ELSE result END,
        intent = CASE WHEN intent->>'goal' = '' THEN jsonb_build_object('goal', title, 'constraints', '[]'::jsonb, 'acceptance', '[]'::jsonb) ELSE intent END,
        external_refs = CASE WHEN external_ref IS NOT NULL AND external_refs = '[]'::jsonb THEN jsonb_build_array(jsonb_build_object('type', 'other', 'value', external_ref)) ELSE external_refs END,
        provenance = CASE WHEN provenance = '{}'::jsonb THEN jsonb_build_object('truth', truth, 'sourceType', CASE WHEN source IN ('human','git','ci') THEN source ELSE 'agent' END, 'sourceName', source, 'actorType', CASE WHEN source = 'human' THEN 'human' ELSE 'agent' END, 'actorName', actor) ELSE provenance END,
        search_text = concat_ws(' ', title, body, external_ref);

      CREATE TABLE IF NOT EXISTS review_events (
        id uuid PRIMARY KEY,
        project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        record_id uuid NOT NULL REFERENCES records(id) ON DELETE CASCADE,
        action text NOT NULL CHECK (action IN ('confirm', 'dismiss', 'retract')),
        from_status text NOT NULL,
        to_status text NOT NULL,
        reviewer text NOT NULL,
        attestation text NOT NULL CHECK (attestation = 'human_reviewed'),
        note text NOT NULL,
        surface text NOT NULL CHECK (surface IN ('web', 'cli', 'api', 'mcp', 'migration')),
        identity_assurance text NOT NULL DEFAULT 'self_asserted',
        idempotency_key text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(record_id, idempotency_key)
      );

      INSERT INTO review_events (id, project_id, record_id, action, from_status, to_status, reviewer, attestation, note, surface, idempotency_key, created_at)
      SELECT gen_random_uuid(), project_id, id, 'confirm', 'captured', 'reviewed', coalesce(reviewed_by, 'legacy-reviewer'), 'human_reviewed', coalesce(review_note, 'Migrated from Octura 0.1'), 'migration', 'migration:review:' || id::text, coalesce(reviewed_at, created_at)
      FROM records
      WHERE status = 'reviewed'
      ON CONFLICT DO NOTHING;

      CREATE TABLE IF NOT EXISTS record_supersessions (
        id uuid PRIMARY KEY,
        project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        predecessor_id uuid NOT NULL REFERENCES records(id) ON DELETE CASCADE,
        replacement_id uuid NOT NULL REFERENCES records(id) ON DELETE CASCADE,
        reviewer text NOT NULL,
        attestation text NOT NULL CHECK (attestation = 'human_reviewed'),
        reason text NOT NULL,
        surface text NOT NULL CHECK (surface IN ('web', 'cli', 'api', 'mcp')),
        idempotency_key text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(predecessor_id),
        UNIQUE(replacement_id),
        UNIQUE(project_id, idempotency_key)
      );

      CREATE TABLE IF NOT EXISTS idempotency_receipts (
        id uuid PRIMARY KEY,
        project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        operation text NOT NULL,
        idempotency_key text NOT NULL,
        request_hash text NOT NULL,
        response jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(project_id, operation, idempotency_key)
      );

      CREATE INDEX IF NOT EXISTS sessions_project_started_idx ON sessions(project_id, started_at DESC, id DESC);
      CREATE INDEX IF NOT EXISTS session_messages_session_sequence_idx ON session_messages(session_id, sequence);
      CREATE INDEX IF NOT EXISTS records_project_kind_idx ON records(project_id, kind);
      CREATE INDEX IF NOT EXISTS records_source_session_idx ON records(source_session_id);
      CREATE INDEX IF NOT EXISTS records_search_trgm_idx ON records USING gin(search_text gin_trgm_ops);
      CREATE INDEX IF NOT EXISTS review_events_record_created_idx ON review_events(record_id, created_at);
    `,
  },
] as const;

export async function migrate(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS octura_migrations (
      id text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  for (const migration of migrations) {
    const [existing] = await sql<{ id: string }[]>`SELECT id FROM octura_migrations WHERE id = ${migration.id}`;
    if (existing) continue;
    await sql.begin(async (transaction) => {
      await transaction.unsafe(migration.sql);
      await transaction`INSERT INTO octura_migrations (id) VALUES (${migration.id})`;
    });
  }
}

export async function closeDatabase(): Promise<void> {
  await sql.end({ timeout: 5 });
}
