import { describe, expect, it } from "vitest";

import { evaluateSymlinkHealth } from "./doctor.js";

describe("evaluateSymlinkHealth", () => {
  it("reports broken links and local overrides for non-primary profiles", () => {
    const issues = evaluateSymlinkHealth({
      isPrimary: false,
      items: [
        { name: "cache", isSymlink: true, pointsToPrimary: true, targetExists: false, existsInPrimary: true },
        { name: "statsig", isSymlink: false, pointsToPrimary: false, targetExists: true, existsInPrimary: true },
      ],
    });

    expect(issues).toHaveLength(2);
    expect(issues[0]?.kind).toBe("broken_symlink");
    expect(issues[1]?.kind).toBe("local_override");
  });

  it("reports directories the primary gained after the profile was set up", () => {
    const issues = evaluateSymlinkHealth({
      isPrimary: false,
      items: [],
      missingSharedDirs: ["jobs", "teams"],
    });

    expect(issues.map((issue) => issue.kind)).toEqual(["missing_shared_link", "missing_shared_link"]);
    expect(issues[0]?.message).toContain("jobs/");
    expect(issues[0]?.message).toContain("clausona repair");
  });

  it("stays silent for the primary and when no missing dirs are given", () => {
    expect(evaluateSymlinkHealth({ isPrimary: true, items: [], missingSharedDirs: ["jobs"] })).toEqual([]);
    expect(evaluateSymlinkHealth({ isPrimary: false, items: [] })).toEqual([]);
  });
});
