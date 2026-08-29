import { describe, expect, it } from "vitest";
import { projectInput, recordInput, recordQuery } from "./domain.js";

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

  it("accepts Spec Kit as an evidence source", () => {
    const record = recordInput.parse({
      kind: "requirement",
      title: "Imported specification",
      body: "# Specification",
      source: "spec-kit",
    });
    expect(record.source).toBe("spec-kit");
  });

  it("filters records imported from Spec Kit", () => {
    expect(recordQuery.parse({ source: "spec-kit" })).toMatchObject({ source: "spec-kit", limit: 100 });
  });
});
