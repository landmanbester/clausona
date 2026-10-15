import type { DoctorIssue } from "../types.js";

export function evaluateSymlinkHealth({
  isPrimary,
  items,
  missingSharedDirs = [],
}: {
  isPrimary: boolean;
  items: Array<{ name: string; isSymlink: boolean; pointsToPrimary: boolean; targetExists: boolean; existsInPrimary: boolean }>;
  /**
   * Directories present in the primary config dir but absent from this profile.
   * Shared links are only created from a snapshot of the primary taken when a
   * profile is set up, and nothing re-runs that pass on `use`, so a directory the
   * primary gains later (Claude Code added `jobs/` and `teams/` after many profiles
   * existed) silently becomes per-profile and the accounts stop sharing that state.
   */
  missingSharedDirs?: string[];
}): DoctorIssue[] {
  if (isPrimary) {
    return [];
  }

  const issues: DoctorIssue[] = [];
  for (const item of items) {
    if (item.isSymlink && !item.targetExists) {
      issues.push({
        kind: "broken_symlink",
        message: `${item.name} points to a missing target`,
      });
    }

    // Should be a symlink to primary but isn't
    if (!item.pointsToPrimary && item.existsInPrimary) {
      issues.push({
        kind: "local_override",
        message: `${item.name} replaced an expected shared symlink`,
      });
    }
  }

  for (const name of missingSharedDirs) {
    issues.push({
      kind: "missing_shared_link",
      message: `${name}/ is shared in the primary but missing here — run 'clausona repair'`,
    });
  }

  return issues;
}
