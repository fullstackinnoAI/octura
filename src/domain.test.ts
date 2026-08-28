import { describe, expect, it } from "vitest";
import { projectInput, recordInput } from "./domain.js";

describe("Octura contracts", () => {
  it("accepts a valid project slug", () => {
    expect(projectInput.parse({ slug: "octura-demo", name: "Octura Demo" }).slug).toBe("octura-demo");
  });

  it("rejects an unsafe project slug", () => {
    expect(() => projectInput.parse({ slug: "Octura Demo", name: "Octura Demo" })).toThrow();
  });

  it("defaults new records to raw human evidence", () => {
    const record = recordInput.parse({ kind: "decision", title: "Keep evidence", body: "Human confirmation is required." });
    expect(record).toMatchObject({ source: "human", truth: "raw", actor: "local-user" });
  });
});
