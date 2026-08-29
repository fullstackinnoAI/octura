import { z } from "zod";

export const recordKinds = [
  "conversation",
  "requirement",
  "decision",
  "code",
  "test",
  "verification",
  "release",
] as const;

export const recordSources = ["human", "codex", "cursor", "claude", "git", "ci", "api", "spec-kit", "other"] as const;

export const projectInput = z.object({
  slug: z
    .string()
    .min(2)
    .max(48)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens"),
  name: z.string().min(2).max(80),
  description: z.string().max(500).default(""),
});

export const recordInput = z.object({
  kind: z.enum(recordKinds),
  title: z.string().min(2).max(160),
  body: z.string().min(1).max(500_000),
  source: z.enum(recordSources).default("human"),
  actor: z.string().min(1).max(120).default("local-user"),
  externalRef: z.string().max(500).optional(),
  truth: z.enum(["raw", "derived"]).default("raw"),
  occurredAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).default({}),
  idempotencyKey: z.string().max(160).optional(),
});

export const recordQuery = z.object({
  status: z.enum(["captured", "reviewed"]).optional(),
  kind: z.enum(recordKinds).optional(),
  source: z.enum(recordSources).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export const reviewInput = z.object({
  note: z.string().max(500).default("Reviewed by a human"),
  actor: z.string().min(1).max(120).default("local-user"),
});

export type ProjectInput = z.infer<typeof projectInput>;
export type RecordInput = z.infer<typeof recordInput>;

export function formatKind(kind: string): string {
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}
