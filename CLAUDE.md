# CLAUDE.md

The canonical guide for working in this repository is [`AGENTS.md`](AGENTS.md), with the
module map in [`src/AGENTS.md`](src/AGENTS.md). Read both before editing.

## Non-negotiables

1. Never share `.claude.json` or `.credentials.json` between profiles.
2. `jobs/` and `teams/` follow `projects/` (share only when `mergeSessions` is true).
3. Merge local session state into the primary before `setupSharedLinks` links it away.
4. Write JSON with `src/core/store.ts` helpers (atomic), never a bare `writeFile`.
5. Guard read-modify-write of `profiles.json` / `usage.json` with `withFileLock`.
6. Shell init must `unalias claude` and must not clobber a user-set
   `CLAUDE_CONFIG_DIR`.
7. Tests must be hermetic (tmpdir, no network, no interactive login).

## Before finishing

```bash
pnpm typecheck && pnpm test && pnpm build
```

`dist/` is gitignored. Commit `type: summary` messages that explain why.
