import { createInterface } from "node:readline";
import { closeDatabase, migrate } from "./db.js";
import {
  API_SCHEMA_VERSION,
  appendMessagesInput,
  captureInput,
  getRecordingProtocol,
  projectInput,
  recordCreateInput,
  recordJsonSchema,
  recordQuery,
  reviewInput,
  sessionCloseInput,
  sessionQuery,
  sessionStartInput,
  supersedeInput,
} from "./domain.js";
import {
  appendMessages,
  captureActivity,
  closeSession,
  createRecord,
  getRecordDetail,
  getSessionDetail,
  listProjects,
  listRecords,
  listSessions,
  reviewRecord,
  startSession,
  supersedeRecord,
  upsertProject,
} from "./service.js";

type RpcRequest = { jsonrpc: "2.0"; id?: string | number | null; method: string; params?: Record<string, unknown> };

const projectProperty = { project: { type: "string", description: "Octura project slug" } };
const tools = [
  { name: "get_recording_protocol", description: "Return the versioned Octura Record prompt and JSON Schemas.", inputSchema: { type: "object", properties: {} } },
  { name: "create_project", description: "Create or update a local Octura project.", inputSchema: { type: "object", required: ["slug", "name"], properties: { slug: { type: "string" }, name: { type: "string" }, description: { type: "string" } } } },
  { name: "list_projects", description: "List local Octura projects.", inputSchema: { type: "object", properties: {} } },
  { name: "capture_activity", description: "Atomically save a complete visible conversation and one or more structured Records.", inputSchema: { type: "object", required: ["project", "input"], properties: { ...projectProperty, input: { type: "object" } } } },
  { name: "start_session", description: "Start a realtime visible-conversation Session.", inputSchema: { type: "object", required: ["project", "input"], properties: { ...projectProperty, input: { type: "object" } } } },
  { name: "append_messages", description: "Append an ordered batch of visible messages to an open Session.", inputSchema: { type: "object", required: ["project", "sessionId", "input"], properties: { ...projectProperty, sessionId: { type: "string" }, input: { type: "object" } } } },
  { name: "close_session", description: "Close a realtime Session and atomically create its Records, or abandon it with a reason.", inputSchema: { type: "object", required: ["project", "sessionId", "input"], properties: { ...projectProperty, sessionId: { type: "string" }, input: { type: "object" } } } },
  { name: "list_sessions", description: "List conversation Sessions for a project.", inputSchema: { type: "object", required: ["project"], properties: { ...projectProperty, status: { type: "string" }, q: { type: "string" }, cursor: { type: "string" }, limit: { type: "number" } } } },
  { name: "get_session", description: "Get a Session with its visible messages and resulting Records.", inputSchema: { type: "object", required: ["project", "sessionId"], properties: { ...projectProperty, sessionId: { type: "string" } } } },
  { name: "create_record", description: "Create a standalone structured Record. Use get_recording_protocol first.", inputSchema: { type: "object", required: ["project", "input"], properties: { ...projectProperty, input: recordJsonSchema } } },
  { name: "list_records", description: "Search and filter Records with cursor pagination.", inputSchema: { type: "object", required: ["project"], properties: { ...projectProperty, status: { type: "string" }, kind: { type: "string" }, sourceName: { type: "string" }, actorName: { type: "string" }, q: { type: "string" }, cursor: { type: "string" }, limit: { type: "number" } } } },
  { name: "get_record", description: "Get a detailed Record, review history, Session link and supersession chain.", inputSchema: { type: "object", required: ["project", "recordId"], properties: { ...projectProperty, recordId: { type: "string" } } } },
  { name: "review_record", description: "Confirm, dismiss or retract a Record using an explicit self-asserted human attestation.", inputSchema: { type: "object", required: ["project", "recordId", "input"], properties: { ...projectProperty, recordId: { type: "string" }, input: { type: "object" } } } },
  { name: "supersede_record", description: "Create a replacement Record and preserve the predecessor as superseded.", inputSchema: { type: "object", required: ["project", "recordId", "input"], properties: { ...projectProperty, recordId: { type: "string" }, input: { type: "object" } } } },
] as const;

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Tool arguments must be an object");
  return value as Record<string, unknown>;
}

function string(value: unknown, name: string): string {
  if (typeof value !== "string" || !value) throw new Error(`${name} is required`);
  return value;
}

async function callTool(name: string, raw: unknown): Promise<unknown> {
  const args = object(raw ?? {});
  if (name === "get_recording_protocol") return getRecordingProtocol();
  if (name === "create_project") return upsertProject(projectInput.parse(args));
  if (name === "list_projects") return listProjects();
  const project = string(args.project, "project");
  if (name === "capture_activity") return captureActivity(project, captureInput.parse(args.input));
  if (name === "start_session") return startSession(project, sessionStartInput.parse(args.input));
  if (name === "append_messages") return appendMessages(project, string(args.sessionId, "sessionId"), appendMessagesInput.parse(args.input));
  if (name === "close_session") return closeSession(project, string(args.sessionId, "sessionId"), sessionCloseInput.parse(args.input));
  if (name === "list_sessions") return listSessions(project, sessionQuery.parse(args));
  if (name === "get_session") return getSessionDetail(project, string(args.sessionId, "sessionId"));
  if (name === "create_record") return createRecord(project, recordCreateInput.parse(args.input));
  if (name === "list_records") return listRecords(project, recordQuery.parse(args));
  if (name === "get_record") return getRecordDetail(project, string(args.recordId, "recordId"));
  if (name === "review_record") return reviewRecord(project, string(args.recordId, "recordId"), reviewInput.parse(args.input), "mcp");
  if (name === "supersede_record") return supersedeRecord(project, string(args.recordId, "recordId"), supersedeInput.parse(args.input), "mcp");
  throw new Error(`Unknown tool: ${name}`);
}

function send(payload: unknown) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

export async function runMcpServer(): Promise<void> {
  await migrate();
  const lines = createInterface({ input: process.stdin, terminal: false });
  await new Promise<void>((resolve) => {
    lines.on("line", (line) => {
      void (async () => {
        let request: RpcRequest;
        try {
          request = JSON.parse(line) as RpcRequest;
        } catch {
          return send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
        }
        if (request.method.startsWith("notifications/")) return;
        try {
          let result: unknown;
          if (request.method === "initialize") {
            result = { protocolVersion: "2025-06-18", capabilities: { tools: { listChanged: false } }, serverInfo: { name: "octura", version: "1.0.0-rc.1" } };
          } else if (request.method === "ping") {
            result = {};
          } else if (request.method === "tools/list") {
            result = { tools };
          } else if (request.method === "tools/call") {
            const name = string(request.params?.name, "name");
            const data = await callTool(name, request.params?.arguments);
            result = { content: [{ type: "text", text: JSON.stringify(data, null, 2) }], structuredContent: { schemaVersion: API_SCHEMA_VERSION, data } };
          } else {
            throw Object.assign(new Error(`Method not found: ${request.method}`), { rpcCode: -32601 });
          }
          if (request.id !== undefined) send({ jsonrpc: "2.0", id: request.id, result });
        } catch (error) {
          if (request.id !== undefined) send({ jsonrpc: "2.0", id: request.id, error: { code: (error as { rpcCode?: number }).rpcCode ?? -32603, message: error instanceof Error ? error.message : String(error) } });
        }
      })();
    });
    lines.on("close", resolve);
  });
  await closeDatabase();
}
