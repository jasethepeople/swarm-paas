import { describe, expect, it } from "vitest";
import { diffFileSnapshots } from "./versioning";

describe("generated app snapshot diffs", () => {
  it("reports added, removed, and modified source files without unchanged noise", () => {
    const changes = diffFileSnapshots(
      [{ path: "client/App.tsx", language: "tsx", content: "old" }, { path: "README.md", language: "markdown", content: "same" }, { path: "server/a.ts", language: "ts", content: "delete" }],
      [{ path: "client/App.tsx", language: "tsx", content: "new" }, { path: "README.md", language: "markdown", content: "same" }, { path: "server/b.ts", language: "ts", content: "add" }],
    );
    expect(changes).toEqual([
      expect.objectContaining({ path: "client/App.tsx", change: "modified", before: "old", after: "new" }),
      expect.objectContaining({ path: "server/a.ts", change: "removed" }),
      expect.objectContaining({ path: "server/b.ts", change: "added" }),
    ]);
  });
});
