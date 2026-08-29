import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  discoverSpecKitArtifacts,
  findSpecKitRoot,
  specKitArtifactRecord,
  specKitIndexRelativePath,
  writeSpecKitIndex,
  type SpecKitImportedArtifact,
} from "./spec-kit.js";

describe("Spec Kit compatibility", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "octura-spec-kit-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  async function fixture(path: string, content: string): Promise<void> {
    const target = join(root, ...path.split("/"));
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content, "utf8");
  }

  it("finds the Spec Kit root from a nested directory", async () => {
    await mkdir(join(root, ".specify"));
    const nested = join(root, "src", "features");
    await mkdir(nested, { recursive: true });

    await expect(findSpecKitRoot(nested)).resolves.toBe(await realpath(root));
  });

  it("reads assessment and delivery artifacts without reading Spec Kit tooling", async () => {
    await fixture(".specify/memory/constitution.md", "# Project Constitution\n\nEvidence must be traceable.\n");
    await fixture(".specify/templates/spec-template.md", "# This is tooling, not a record\n");
    await fixture(".specify/assessments/offline-mode/intake.md", "# Offline Mode Intake\n\nRaw idea.\n");
    await fixture(".specify/assessments/offline-mode/research.md", "# Offline Mode Research\n\nEvidence.\n");
    await fixture(".specify/assessments/offline-mode/problem.md", "# Offline Mode Problem\n\nProblem.\n");
    await fixture(".specify/assessments/offline-mode/concept.md", "# Offline Mode Concept\n\nOptions.\n");
    await fixture(".specify/assessments/offline-mode/decision.md", "# Offline Mode Decision\n\nVerdict: go.\n");
    await fixture("specs/001-offline-mode/spec.md", "# Offline Mode Specification\n\nRequirements.\n");
    await fixture("specs/001-offline-mode/plan.md", "# Offline Mode Plan\n\nArchitecture.\n");
    await fixture("specs/001-offline-mode/tasks.md", "# Offline Mode Tasks\n\n- [ ] Implement.\n");
    await fixture("specs/001-offline-mode/checklists/requirements.md", "# Requirements Checklist\n\n- [x] Complete.\n");
    await fixture("specs/001-offline-mode/contracts/sync.yaml", "openapi: 3.1.0\n");

    const discovered = await discoverSpecKitArtifacts(root);

    expect(discovered.artifacts.map((artifact) => artifact.relativePath)).toEqual([
      ".specify/memory/constitution.md",
      ".specify/assessments/offline-mode/intake.md",
      ".specify/assessments/offline-mode/research.md",
      ".specify/assessments/offline-mode/problem.md",
      ".specify/assessments/offline-mode/concept.md",
      ".specify/assessments/offline-mode/decision.md",
      "specs/001-offline-mode/spec.md",
      "specs/001-offline-mode/plan.md",
      "specs/001-offline-mode/tasks.md",
      "specs/001-offline-mode/checklists/requirements.md",
      "specs/001-offline-mode/contracts/sync.yaml",
    ]);
    expect(discovered.artifacts.map((artifact) => artifact.kind)).toEqual([
      "decision",
      "conversation",
      "verification",
      "requirement",
      "decision",
      "decision",
      "requirement",
      "decision",
      "requirement",
      "verification",
      "code",
    ]);
  });

  it("maps artifacts to idempotent raw Spec Kit records", async () => {
    await fixture(".specify/assessments/offline-mode/problem.md", "# Offline Mode Problem\n\nProblem.\n");
    const { artifacts } = await discoverSpecKitArtifacts(root);
    const record = specKitArtifactRecord(artifacts[0]!);

    expect(record).toMatchObject({
      kind: "requirement",
      source: "spec-kit",
      actor: "spec-kit",
      truth: "raw",
      externalRef: "spec-kit:.specify/assessments/offline-mode/problem.md",
    });
    expect(record.idempotencyKey).toMatch(/^spec-kit:[a-f0-9]{32}:[a-f0-9]{32}$/);
    expect(record.metadata).toMatchObject({
      provider: "spec-kit",
      artifactFamily: "assessment",
      artifactStage: "define",
      artifactSlug: "offline-mode",
    });
  });

  it("writes only an oct-prefixed index under the Octura namespace", async () => {
    await fixture(".specify/assessments/offline-mode/decision.md", "# Decision\n\nVerdict: go.\n");
    const { artifacts } = await discoverSpecKitArtifacts(root);
    const imported: SpecKitImportedArtifact[] = artifacts.map((artifact) => ({
      ...artifact,
      recordId: "record-1",
      status: "captured",
    }));

    const indexPath = await writeSpecKitIndex(root, "offline-mode", imported, "2026-08-29T00:00:00.000Z");
    const index = JSON.parse(await readFile(indexPath, "utf8")) as { schemaVersion: string; artifacts: Array<{ path: string }> };

    expect(indexPath).toBe(join(root, ...specKitIndexRelativePath.split("/")));
    expect(index.schemaVersion).toBe("octura.spec-kit-index.v1");
    expect(index.artifacts[0]?.path).toBe(".specify/assessments/offline-mode/decision.md");
    await expect(readFile(join(root, ".specify", "assessments", "offline-mode", "decision.md"), "utf8")).resolves.toContain(
      "Verdict: go",
    );
  });
});
