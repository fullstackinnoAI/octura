import { describe, expect, it } from "vitest";
import { resolveCommandPositionals } from "./cli-command.js";

describe("Octura CLI command names", () => {
  it.each([
    ["octura-doctor", ["doctor"]],
    ["octura-demo-seed", ["demo", "seed"]],
    ["octura-project-create", ["project", "create"]],
    ["octura-project-list", ["project", "list"]],
    ["octura-record-add", ["record", "add"]],
    ["octura-record-list", ["record", "list"]],
    ["octura-record-review", ["record", "review"]],
    ["octura-spec-kit-import", ["spec-kit", "import"]],
  ])("maps %s to its internal command", (commandName, expected) => {
    expect(resolveCommandPositionals(`/usr/local/bin/${commandName}`, [])).toEqual(expected);
  });

  it("does not fall back to the removed octura subcommand form", () => {
    expect(resolveCommandPositionals("/usr/local/bin/octura", ["record", "list"])).toEqual([]);
  });

  it("recognizes a package-manager shim target with a JavaScript extension", () => {
    expect(resolveCommandPositionals("/app/dist/octura-spec-kit-import.js", [])).toEqual(["spec-kit", "import"]);
  });

  it("recognizes a TypeScript entry during local development", () => {
    expect(resolveCommandPositionals("/app/src/octura-doctor.ts", [])).toEqual(["doctor"]);
  });
});
