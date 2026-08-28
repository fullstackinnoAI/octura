import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL ?? "postgresql://octura:octura@localhost:5432/octura";

export const sql = postgres(databaseUrl, {
  max: Number(process.env.DB_POOL_SIZE ?? 10),
  idle_timeout: 20,
  connect_timeout: 10,
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
