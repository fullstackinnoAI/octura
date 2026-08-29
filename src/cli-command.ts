import { basename } from "node:path";

const commandAliases: Record<string, readonly string[]> = {
  "octura-doctor": ["doctor"],
  "octura-demo-seed": ["demo", "seed"],
  "octura-project-create": ["project", "create"],
  "octura-project-list": ["project", "list"],
  "octura-record-add": ["record", "add"],
  "octura-record-list": ["record", "list"],
  "octura-record-review": ["record", "review"],
  "octura-spec-kit-import": ["spec-kit", "import"],
};

export function resolveCommandPositionals(entryPath: string | undefined, positionals: string[]): string[] {
  const commandName = entryPath ? basename(entryPath).replace(/\.(?:c|m)?(?:j|t)s$/, "") : "";
  const command = commandAliases[commandName];
  return command ? [...command, ...positionals] : [];
}
