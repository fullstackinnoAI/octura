import { describe, expect, it } from "vitest";
import {
  OcturaError,
  appendMessagesInput,
  assertSafeMessages,
  captureInput,
  findSensitiveContent,
  getRecordingProtocol,
  nextRecordStatus,
  projectInput,
  recordCreateInput,
  sessionCloseInput,
} from "./domain.js";

const record = {
  kind: "change",
  title: "统一 Octura 记录内核",
  outcomeStatus: "completed",
  intent: { goal: "让 CLI、API 与 MCP 复用同一契约" },
  result: "共享服务已经落地。",
  provenance: { truth: "derived", sourceType: "agent", sourceName: "codex", actorType: "agent", actorName: "codex" },
  idempotencyKey: "record-contract-v1",
};

describe("Octura 1.0 contracts", () => {
  it("accepts a safe project slug", () => {
    expect(projectInput.parse({ slug: "octura-demo", name: "Octura Demo" }).slug).toBe("octura-demo");
  });

  it("rejects an unsafe project slug", () => {
    expect(() => projectInput.parse({ slug: "Octura Demo", name: "Octura Demo" })).toThrow();
  });

  it("normalizes a structured Record to octura.record.v1", () => {
    expect(recordCreateInput.parse(record)).toMatchObject({
      schemaVersion: "octura.record.v1",
      changes: [], decisions: [], verification: [], risks: [], nextSteps: [], externalRefs: [],
    });
  });

  it("requires a concrete intent goal", () => {
    expect(() => recordCreateInput.parse({ ...record, intent: { goal: "" } })).toThrow();
  });

  it("validates a complete atomic Capture", () => {
    const capture = captureInput.parse({
      idempotencyKey: "capture-v1",
      session: {
        title: "Octura contract work", sourceType: "agent", sourceName: "codex", actorType: "agent", actorName: "codex",
        messages: [{ role: "user", content: "实现记录契约" }],
      },
      records: [record],
    });
    expect(capture.records).toHaveLength(1);
    expect(capture.session.messages[0]?.role).toBe("user");
    expect(capture.session.startedAt).toBeUndefined();
    expect(capture.session.messages[0]?.occurredAt).toBeUndefined();
    expect(capture.records[0]?.occurredAt).toBeUndefined();
  });

  it("keeps runtime timestamps outside idempotency request parsing", () => {
    const first = recordCreateInput.parse(record);
    const replay = recordCreateInput.parse(record);
    expect(first).toEqual(replay);
    expect(first.occurredAt).toBeUndefined();
  });

  it("starts realtime message sequencing at one", () => {
    expect(() => appendMessagesInput.parse({ expectedSequence: 0, messages: [{ role: "user", content: "zero" }], idempotencyKey: "zero" })).toThrow();
    expect(appendMessagesInput.parse({ expectedSequence: 1, messages: [{ role: "user", content: "one" }], idempotencyKey: "one" }).expectedSequence).toBe(1);
  });

  it("allows closed sessions only with Records", () => {
    expect(() => sessionCloseInput.parse({ action: "close", records: [], idempotencyKey: "close-1" })).toThrow();
    expect(sessionCloseInput.parse({ action: "abandon", reason: "任务取消", idempotencyKey: "abandon-1" }).action).toBe("abandon");
  });

  it("rejects hidden reasoning roles", () => {
    expect(() => captureInput.parse({ idempotencyKey: "bad", session: { title: "Bad", sourceType: "agent", sourceName: "x", actorType: "agent", actorName: "x", messages: [{ role: "analysis", content: "hidden" }] }, records: [record] })).toThrow();
  });

  it("detects high-confidence credentials", () => {
    expect(findSensitiveContent("token=abcdefghijklmnop1234567890")).toBe("assigned_secret");
    expect(() => assertSafeMessages([{ role: "user", content: "sk-abcdefghijklmnopqrstuvwxyz1234", occurredAt: new Date().toISOString(), metadata: {} }])).toThrowError(OcturaError);
  });

  it("enforces append-only review transitions", () => {
    expect(nextRecordStatus("captured", "confirm")).toBe("reviewed");
    expect(nextRecordStatus("captured", "dismiss")).toBe("dismissed");
    expect(nextRecordStatus("reviewed", "retract")).toBe("retracted");
    expect(() => nextRecordStatus("reviewed", "confirm")).toThrowError(OcturaError);
  });

  it("publishes a versioned prompt and both schemas", () => {
    const protocol = getRecordingProtocol();
    expect(protocol.promptVersion).toBe("octura.recording-prompt.v1");
    expect(protocol.recordSchema.$id).toBe("octura.record.v1");
    expect(protocol.captureSchema.$id).toBe("octura.capture.v1");
  });
});
