#!/usr/bin/env node
import { runMcpServer } from "./mcp.js";
void runMcpServer().catch((error) => {
  console.error(`Octura MCP: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
