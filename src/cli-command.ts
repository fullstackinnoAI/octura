import { basename } from "node:path";

const commandAliases: Record<string, readonly string[]> = {
  "octura-record-prompt": ["record", "prompt"],
  "octura-project-create": ["project", "create"],
  "octura-project-list": ["project", "list"],
  "octura-project-show": ["project", "show"],
  "octura-capture-add": ["capture", "add"],
  "octura-session-start": ["session", "start"],
  "octura-session-append": ["session", "append"],
  "octura-session-close": ["session", "close"],
  "octura-record-add": ["record", "add"],
  "octura-record-list": ["record", "list"],
  "octura-record-get": ["record", "get"],
  "octura-record-review": ["record", "review"],
  "octura-record-supersede": ["record", "supersede"],
  "octura-mcp": ["mcp"],
  "octura-doctor": ["doctor"],
  "octura-demo-seed": ["demo", "seed"],
};

export function resolveCommandPositionals(entryPath: string | undefined, positionals: string[]): string[] {
  const commandName = entryPath ? basename(entryPath).replace(/\.(?:c|m)?js$/, "") : "";
  const command = commandAliases[commandName];
  return command ? [...command, ...positionals] : positionals;
}
