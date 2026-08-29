import { createHash, randomUUID } from "node:crypto";
import type { Stats } from "node:fs";
import {
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import type { RecordInput } from "./domain.js";

export const specKitImportSchema = "octura.spec-kit-import.v1";
export const specKitIndexRelativePath = ".octura/oct-imports/oct-spec-kit-index.json";

type ArtifactFamily = "governance" | "assessment" | "feature" | "contract" | "checklist";

type StageDefinition = {
  file: string;
  stage: string;
  label: string;
  kind: RecordInput["kind"];
};

const assessmentStages: StageDefinition[] = [
  { file: "intake.md", stage: "intake", label: "Idea intake", kind: "conversation" },
  { file: "research.md", stage: "research", label: "Idea research", kind: "verification" },
  { file: "problem.md", stage: "define", label: "Problem definition", kind: "requirement" },
  { file: "concept.md", stage: "shape", label: "Solution concept", kind: "decision" },
  { file: "decision.md", stage: "decide", label: "Assessment decision", kind: "decision" },
];

const featureStages: StageDefinition[] = [
  { file: "spec.md", stage: "specify", label: "Feature specification", kind: "requirement" },
  { file: "research.md", stage: "research", label: "Technical research", kind: "verification" },
  { file: "plan.md", stage: "plan", label: "Implementation plan", kind: "decision" },
  { file: "data-model.md", stage: "data-model", label: "Data model", kind: "decision" },
  { file: "tasks.md", stage: "tasks", label: "Implementation tasks", kind: "requirement" },
  { file: "quickstart.md", stage: "quickstart", label: "Quickstart verification", kind: "verification" },
];

const contractExtensions = new Set([".json", ".md", ".txt", ".yaml", ".yml"]);
const checklistExtensions = new Set([".md"]);
const maxArtifactBytes = 500_000;

export type SpecKitArtifact = {
  absolutePath: string;
  relativePath: string;
  family: ArtifactFamily;
  slug: string;
  stage: string;
  kind: RecordInput["kind"];
  title: string;
  body: string;
  contentSha256: string;
  occurredAt: string;
};

export type SpecKitImportedArtifact = SpecKitArtifact & {
  recordId: string;
  status: string;
};

async function statIfExists(path: string): Promise<Stats | null> {
  try {
    return await lstat(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

function assertInsideRoot(root: string, path: string): void {
  const child = relative(root, path);
  if (!child || (!isAbsolute(child) && child !== ".." && !child.startsWith(`..${sep}`))) return;
  throw new Error(`Spec Kit 路径越过项目根目录：${path}`);
}

async function assertRealDirectory(path: string, root: string, optional = false): Promise<boolean> {
  const stat = await statIfExists(path);
  if (!stat && optional) return false;
  if (!stat) throw new Error(`目录不存在：${path}`);
  if (stat.isSymbolicLink()) throw new Error(`拒绝读取符号链接目录：${path}`);
  if (!stat.isDirectory()) throw new Error(`预期目录但发现其他类型：${path}`);
  assertInsideRoot(root, await realpath(path));
  return true;
}

export async function findSpecKitRoot(startPath = process.cwd()): Promise<string> {
  let current = resolve(startPath);
  const startStat = await statIfExists(current);
  if (!startStat) throw new Error(`--root 指向的路径不存在：${current}`);
  if (!startStat.isDirectory()) current = dirname(current);
  current = await realpath(current);

  while (true) {
    const marker = join(current, ".specify");
    const markerStat = await statIfExists(marker);
    if (markerStat) {
      if (markerStat.isSymbolicLink()) throw new Error(`拒绝读取符号链接目录：${marker}`);
      if (!markerStat.isDirectory()) throw new Error(`Spec Kit 标记不是目录：${marker}`);
      return current;
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }

  throw new Error(`从 ${startPath} 向上未找到 Spec Kit 项目（缺少 .specify/）`);
}

function markdownTitle(content: string, fallback: string): string {
  const heading = content.split(/\r?\n/).find((line) => /^#\s+\S/.test(line));
  return (heading?.replace(/^#\s+/, "").trim() || fallback).slice(0, 160);
}

async function readArtifact(
  root: string,
  path: string,
  identity: Omit<SpecKitArtifact, "absolutePath" | "relativePath" | "title" | "body" | "contentSha256" | "occurredAt"> & {
    fallbackTitle: string;
  },
): Promise<SpecKitArtifact | null> {
  const stat = await statIfExists(path);
  if (!stat) return null;
  if (stat.isSymbolicLink()) throw new Error(`拒绝读取符号链接文件：${path}`);
  if (!stat.isFile()) return null;
  if (stat.size > maxArtifactBytes) throw new Error(`Spec Kit 记录超过 ${maxArtifactBytes} 字节限制：${path}`);

  const resolvedPath = await realpath(path);
  assertInsideRoot(root, resolvedPath);
  const body = await readFile(resolvedPath, "utf8");
  if (!body.trim()) return null;
  const relativePath = relative(root, resolvedPath).split("\\").join("/");

  return {
    absolutePath: resolvedPath,
    relativePath,
    family: identity.family,
    slug: identity.slug,
    stage: identity.stage,
    kind: identity.kind,
    title: markdownTitle(body, identity.fallbackTitle),
    body,
    contentSha256: createHash("sha256").update(body).digest("hex"),
    occurredAt: stat.mtime.toISOString(),
  };
}

async function realSubdirectories(root: string, parent: string): Promise<string[]> {
  if (!(await assertRealDirectory(parent, root, true))) return [];
  const entries = await readdir(parent, { withFileTypes: true });
  const directories: string[] = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const path = join(parent, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`拒绝读取符号链接目录：${path}`);
    if (entry.isDirectory()) directories.push(path);
  }
  return directories;
}

async function discoverNestedArtifacts(
  root: string,
  featureDir: string,
  slug: string,
  definition: {
    directory: string;
    family: ArtifactFamily;
    stage: string;
    kind: RecordInput["kind"];
    label: string;
    extensions: Set<string>;
  },
): Promise<SpecKitArtifact[]> {
  const artifactDir = join(featureDir, definition.directory);
  if (!(await assertRealDirectory(artifactDir, root, true))) return [];
  const artifacts: SpecKitArtifact[] = [];

  async function walk(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      const path = join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`拒绝读取符号链接：${path}`);
      if (entry.isDirectory()) {
        await walk(path);
        continue;
      }
      if (!entry.isFile() || !definition.extensions.has(extname(entry.name).toLowerCase())) continue;
      const artifact = await readArtifact(root, path, {
        family: definition.family,
        slug,
        stage: definition.stage,
        kind: definition.kind,
        fallbackTitle: `${slug} · ${definition.label} · ${relative(artifactDir, path)}`,
      });
      if (artifact) artifacts.push(artifact);
    }
  }

  await walk(artifactDir);
  return artifacts;
}

async function configuredFeatureDirectory(root: string): Promise<string | null> {
  const featureState = join(root, ".specify", "feature.json");
  const stat = await statIfExists(featureState);
  if (!stat) return null;
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`无效的 Spec Kit feature.json：${featureState}`);
  let state: { feature_directory?: unknown };
  try {
    state = JSON.parse(await readFile(featureState, "utf8")) as { feature_directory?: unknown };
  } catch {
    return null;
  }
  if (typeof state.feature_directory !== "string" || !state.feature_directory.trim()) return null;
  const featureDir = resolve(root, state.feature_directory);
  assertInsideRoot(root, featureDir);
  if (relative(root, featureDir).split(/[\\/]/)[0] === ".octura") {
    throw new Error("Spec Kit feature_directory 不能指向 Octura 的 .octura/ 命名空间");
  }
  return (await assertRealDirectory(featureDir, root, true)) ? featureDir : null;
}

export async function discoverSpecKitArtifacts(startPath = process.cwd()): Promise<{ root: string; artifacts: SpecKitArtifact[] }> {
  const root = await findSpecKitRoot(startPath);
  const artifacts: SpecKitArtifact[] = [];

  const constitution = await readArtifact(root, join(root, ".specify", "memory", "constitution.md"), {
    family: "governance",
    slug: "project",
    stage: "constitution",
    kind: "decision",
    fallbackTitle: "Project constitution",
  });
  if (constitution) artifacts.push(constitution);

  const assessmentDirs = await realSubdirectories(root, join(root, ".specify", "assessments"));
  for (const assessmentDir of assessmentDirs) {
    const slug = basename(assessmentDir);
    for (const definition of assessmentStages) {
      const artifact = await readArtifact(root, join(assessmentDir, definition.file), {
        family: "assessment",
        slug,
        stage: definition.stage,
        kind: definition.kind,
        fallbackTitle: `${slug} · ${definition.label}`,
      });
      if (artifact) artifacts.push(artifact);
    }
  }

  const featureDirectories = new Set(await realSubdirectories(root, join(root, "specs")));
  const configuredFeature = await configuredFeatureDirectory(root);
  if (configuredFeature) featureDirectories.add(configuredFeature);

  for (const featureDir of [...featureDirectories].sort()) {
    const slug = basename(featureDir);
    for (const definition of featureStages) {
      const artifact = await readArtifact(root, join(featureDir, definition.file), {
        family: "feature",
        slug,
        stage: definition.stage,
        kind: definition.kind,
        fallbackTitle: `${slug} · ${definition.label}`,
      });
      if (artifact) artifacts.push(artifact);
    }
    artifacts.push(
      ...(await discoverNestedArtifacts(root, featureDir, slug, {
        directory: "checklists",
        family: "checklist",
        stage: "checklist",
        kind: "verification",
        label: "Checklist",
        extensions: checklistExtensions,
      })),
      ...(await discoverNestedArtifacts(root, featureDir, slug, {
        directory: "contracts",
        family: "contract",
        stage: "contract",
        kind: "code",
        label: "Contract",
        extensions: contractExtensions,
      })),
    );
  }

  return { root, artifacts };
}

export function specKitArtifactRecord(artifact: SpecKitArtifact): RecordInput {
  const pathHash = createHash("sha256").update(artifact.relativePath).digest("hex");
  const externalRef = `spec-kit:${artifact.relativePath}`;
  return {
    kind: artifact.kind,
    title: artifact.title,
    body: artifact.body,
    source: "spec-kit",
    actor: "spec-kit",
    externalRef: externalRef.length <= 500 ? externalRef : `spec-kit:sha256:${pathHash}`,
    truth: "raw",
    occurredAt: artifact.occurredAt,
    metadata: {
      provider: "spec-kit",
      importSchema: specKitImportSchema,
      artifactFamily: artifact.family,
      artifactStage: artifact.stage,
      artifactSlug: artifact.slug,
      relativePath: artifact.relativePath,
      contentSha256: artifact.contentSha256,
    },
    idempotencyKey: `spec-kit:${pathHash.slice(0, 32)}:${artifact.contentSha256.slice(0, 32)}`,
  };
}

async function ensureOcturaDirectory(root: string, path: string): Promise<void> {
  const stat = await statIfExists(path);
  if (stat) {
    if (stat.isSymbolicLink()) throw new Error(`拒绝写入符号链接目录：${path}`);
    if (!stat.isDirectory()) throw new Error(`Octura 状态路径不是目录：${path}`);
    assertInsideRoot(root, await realpath(path));
    return;
  }
  await mkdir(path);
}

export async function writeSpecKitIndex(
  root: string,
  projectSlug: string,
  artifacts: SpecKitImportedArtifact[],
  generatedAt = new Date().toISOString(),
): Promise<string> {
  const octuraDir = join(root, ".octura");
  const importsDir = join(octuraDir, "oct-imports");
  await ensureOcturaDirectory(root, octuraDir);
  await ensureOcturaDirectory(root, importsDir);

  const indexPath = join(root, ...specKitIndexRelativePath.split("/"));
  const indexStat = await statIfExists(indexPath);
  if (indexStat?.isSymbolicLink()) throw new Error(`拒绝覆盖符号链接文件：${indexPath}`);

  const payload = {
    schemaVersion: "octura.spec-kit-index.v1",
    generatedAt,
    project: projectSlug,
    source: { provider: "spec-kit", root: ".", marker: ".specify" },
    artifacts: artifacts.map((artifact) => ({
      path: artifact.relativePath,
      family: artifact.family,
      slug: artifact.slug,
      stage: artifact.stage,
      kind: artifact.kind,
      contentSha256: artifact.contentSha256,
      recordId: artifact.recordId,
      status: artifact.status,
    })),
  };

  const temporaryPath = join(importsDir, `oct-spec-kit-index-${randomUUID()}.tmp`);
  await writeFile(temporaryPath, `${JSON.stringify(payload, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  try {
    await rename(temporaryPath, indexPath);
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
  return indexPath;
}
