# GitHub Copilot instructions

The canonical agent guide is [`AGENTS.md`](../AGENTS.md) (root) and
[`src/AGENTS.md`](../src/AGENTS.md). Follow them.

## Repository in one paragraph

clausona is a Node.js CLI plus a shell hook that lets one machine hold multiple Claude
Code accounts. Each account is a separate config directory (`~/.claude`,
`~/.claude-work`, …). clausona symlinks shared resources (MCP servers, plugins,
settings) and keeps credentials and session history profile-local by default.
`clausona use <name>` switches the active account; the `claude()` shell wrapper applies
it. There is no daemon or proxy.

## Rules

1. Never share `.claude.json` or `.credentials.json` between profiles — doing so makes
   every profile authenticate as the primary.
2. `jobs/` and `teams/` must follow `projects/` under the `mergeSessions` setting.
3. Merge a profile's local session state into the primary before it is replaced with a
   symlink.
4. Persist JSON only through `src/core/store.ts` (atomic writes); wrap shared
   read-modify-write cycles in `withFileLock`.
5. Keep `core/doctor.ts` and `core/usage.ts` pure and unit-tested.
6. New tests must be hermetic (temp dirs, no network, no real user config).
7. Run `pnpm typecheck && pnpm test && pnpm build` before proposing changes.

## Layout

- `src/index.tsx` — entry/dispatch
- `src/commands.ts` — CLI parsing and help
- `src/lib/service.ts` — stateful core logic
- `src/core/` — paths, JSON store + locks, usage, tracking, doctor, shell
- `src/tui/` — Ink/React dashboard
- tests are colocated `*.test.ts(x)`
