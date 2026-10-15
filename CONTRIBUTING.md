# Contributing to clausona

Thanks for helping! This guide gets you from a fresh clone to a passing pull request.
If you're an AI agent, read [`AGENTS.md`](AGENTS.md) and [`src/AGENTS.md`](src/AGENTS.md)
first — they contain the invariants you must not break.

## Prerequisites

- **Node.js >= 20** (`node --version`)
- **pnpm** (`corepack enable` and `corepack prepare pnpm@9 --activate`, or
  `npm install -g pnpm`)
- **Claude Code CLI** on your `PATH` if you want to exercise the real flows
  (`claude --version`)

## Get set up

```bash
git clone https://github.com/landmanbester/clausona.git
cd clausona
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

Run your build directly without touching your installed copy:

```bash
node dist/index.js --help
node dist/index.js list
```

To dogfood it as the real `clausona`:

```bash
cp dist/index.js ~/.local/share/clausona/index.js
```

(That path is where the launcher from the README points. Re-copy after each build.)

## Everyday commands

| Command | What it does |
|---------|--------------|
| `pnpm test` | Run the full vitest suite once |
| `pnpm test:watch` | Re-run tests on change |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm build` | Bundle to `dist/index.js` (executable) |

Before opening a PR:

```bash
pnpm typecheck && pnpm test && pnpm build
```

## Project layout

See the table in [`README.md`](README.md#project-layout) and the deeper map in
[`src/AGENTS.md`](src/AGENTS.md). The short version:

- `src/index.tsx` — entry point and dispatch
- `src/commands.ts` — CLI parsing, help, `runCommand`
- `src/lib/service.ts` — all the stateful logic
- `src/core/` — paths, atomic JSON store, usage, tracking, doctor, shell
- `src/tui/` — the Ink dashboard
- tests are colocated as `*.test.ts(x)`

## Code style

- TypeScript, `strict` mode. Prefer explicit return types for exported functions.
- Keep modules dependency-light; the only runtime deps are Ink/React, chalk and zod.
  Ask before adding a new dependency.
- Put IO and state in `service.ts`; keep `core/doctor.ts`, `core/usage.ts` and
  `core/paths.ts` pure/testable.
- No `any` unless you explain it in a comment (or the value is genuinely untyped, like
  legacy usage records).
- Comments should explain *why* (especially for workarounds), not narrate *what*.

## Tests

- Add a test for every bug fix and new behaviour.
- Keep tests hermetic: no network, no real `~/.claude`, no interactive login. Use a
  temp directory (`mkdtempSync`) and clean up.
- Filesystem/locking helpers belong in `src/core/store.test.ts`; pure math in
  `src/core/usage.test.ts`; emitted shell text in `src/core/shell.test.ts`.

```bash
pnpm test                       # everything
pnpm test src/core/usage.test.ts   # one file
```

## Commits and pull requests

- Branch from `main`; keep PRs focused.
- Commit messages: `type: summary` with `fix:`, `feat:`, `perf:`, `docs:`, `chore:`,
  `test:` or `refactor:`. In the body, explain the user-visible effect and any
  migration/repair steps.
- In the PR description, list the commands you ran and any manual verification.
- A maintainer reviews and merges. Releases are cut by pushing a `v*` tag after the
  version in `package.json` is bumped (see `.github/workflows/release.yml`).

## Reporting bugs

Please include:

1. What you ran and what you expected.
2. The output of `clausona doctor` (redact e-mail addresses if you like).
3. `clausona current`, your OS, shell, and `node --version`.
4. Whether `ANTHROPIC_API_KEY` is set in your environment — it overrides per-profile
   OAuth and explains many "switching does nothing" reports.

## Security

clausona reads Claude Code credential files to detect accounts. Never paste real tokens
into issues or tests. If you find a way to leak credentials between profiles, treat it
as a security bug — it is exactly the class of problem `AGENTS.md` golden rule #1 exists
to prevent.
