import { describe, expect, it } from "vitest";
import { resolveCommandPositionals } from "./cli-command.js";

describe("standalone Octura commands", () => {
  it.each([
    ["octura-record-prompt", ["record", "prompt"]],
    ["octura-project-create", ["project", "create"]],
    ["octura-capture-add", ["capture", "add"]],
    ["octura-session-start", ["session", "start"]],
    ["octura-session-append", ["session", "append"]],
    ["octura-session-close", ["session", "close"]],
    ["octura-record-add", ["record", "add"]],
    ["octura-record-get", ["record", "get"]],
    ["octura-record-review", ["record", "review"]],
    ["octura-record-supersede", ["record", "supersede"]],
    ["octura-mcp", ["mcp"]],
  ])("maps %s to its stable command", (command, expected) => {
    expect(resolveCommandPositionals(`/usr/local/bin/${command}`, [])).toEqual(expected);
  });

  it("keeps octura subcommands as a compatibility entry", () => {
    expect(resolveCommandPositionals("/app/dist/cli.js", ["record", "list"])).toEqual(["record", "list"]);
  });
});
