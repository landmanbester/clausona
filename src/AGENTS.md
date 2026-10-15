# src/AGENTS.md — module map

Read the root [`../AGENTS.md`](../AGENTS.md) first; its golden rules apply everywhere
here. This file says where things live and what to keep in sync when you change them.

## Entry and dispatch

### `index.tsx`
Process entry. `parseCommand(argv)` turns argv into one of:
- `{ kind: "tui" }` — no args; renders the dashboard (refuses when not a TTY).
- `{ kind: "exec", profile, args }` — `clausona run <profile> ...`; resolves the
  profile env and `spawnSync`s `claude`, then tracks usage.
- `{ kind: "command", command, args }` — everything else, handed to `runCommand`.

The bottom entry guard must stay defensive: `process.argv[1]` is undefined when the
bundle is imported, so compare via `pathToFileURL(realpathSync(entry))` inside a
`try/catch`.

### `commands.ts`
- `commandFlags` — the single source of allowed flags; `validateFlags` errors on
  unknown ones. Add new flags here or they are rejected.
- `subcommandHelpText` / `usageText` — user-facing help. Keep in sync with `README.md`.
- `runCommand` — the switch. Returns a string to print, or `__OPEN_TUI__:<screen>` to
  launch a TUI screen.
- `version` reads the version from `package.json`; never hard-code it.

## Core building blocks (`src/core/`)

### `paths.ts`
`claudeJsonPathForConfigDir` and `keychainServiceForConfigDir`. The primary config dir
(`~/.claude`) keeps its JSON at `~/.claude.json`; secondary dirs put `.claude.json`
inside the dir. Keychain service names are hashed from the resolved config dir. Use
these helpers everywhere instead of building paths by hand.

### `store.ts`
All filesystem/JSON plumbing:
- `exists`, `readJson` (with fallback), `writeJson` / `atomicWrite` (temp + rename),
  `writeJsonIfChanged`.
- `withFileLock` — best-effort cross-process mutex (mkdir-based, stale-safe). Wrap any
  read-modify-write of a shared JSON file.

Changing these helpers affects the whole app; keep them dependency-free and covered by
`store.test.ts`.

### `usage.ts`
Pure period math: `cutoffForPeriod`, `summarizeUsage` (one period) and
`summarizeUsagePeriods` (all periods in one pass). Use `summarizeUsagePeriods` when you
need more than one period. All cutoffs are local-time based. `usage.test.ts` covers the
week/Monday and month boundaries — keep them passing.

### `track-usage.ts`
`trackUsage` / `seedSeenSessions`. Reads the profile's `.claude.json`, fingerprints each
project (`buildFingerprint`), appends a record when it changed, and stores the
fingerprint in `seenSessions`. The whole read-modify-write runs under
`withFileLock(USAGE_PATH)`. `claudeJsonPathForProfile` resolves the primary vs secondary
JSON path.

### `doctor.ts`
`evaluateSymlinkHealth` is pure: given per-entry link facts plus `missingSharedDirs`, it
returns `DoctorIssue[]`. It must stay pure (no IO) so it is trivially testable. The IO
that feeds it lives in `doctorProfiles` (`service.ts`).

### `registry.ts`
`setActiveProfile` — a small, pure copy-on-write helper. Keep persistence in
`service.ts`.

### `shell.ts`
`renderShellInit()` emits the shell integration as a string. Contract:
- Read `~/.clausona/active-config` first (`_clausona_active_config`); fall back to
  parsing `profiles.json` with Node (`_clausona_resolve_config_slow`).
- `unalias claude` before defining the function.
- Only `unset CLAUDE_CONFIG_DIR` if the wrapper set it (`_clausona_set_cfg`).
- Register `alias csn=clausona`.
`shell.test.ts` asserts on the emitted text; update it with any contract change.

## Core logic (`src/lib/`)

### `service.ts`
The heart of the app. Everything stateful lives here. Key exports and what they own:

| Export | Responsibility |
|--------|----------------|
| `syncPluginsJson` | Rewrites per-profile plugin JSON paths; must never block `claude` (wrapped in try/catch) and should skip no-op writes |
| `validateConfigDir` | Validate a user-supplied `--from` path |
| `discoverAccounts` | Scan `~/.claude*` and check credentials (`checkKeychain`) |
| `loadRegistry` / `saveRegistry` | Registry persistence + `active-config` regeneration + lock |
| `initializeRegistry` | Set up profiles/backups/links; **preserves existing usage** |
| `setActiveProfileByName` | Switch active profile |
| `listProfiles` / `getCurrentProfile` / `getUsageSummary` | Read-only queries |
| `doctorProfiles` | Collect facts, walk the primary for missing shared dirs, detect `account_mismatch` |
| `repairProfile` | Merge session state, restore overwritten account, rebuild links |
| `updateProfileConfig` | Toggle merged/separated sessions and migrate records |
| `addProfile` / `removeProfile` / `loginProfile` | Lifecycle (with profile-name validation) |
| `resolveProfileEnv` | Env for `clausona run` |
| `shellInit` / `uninstallClausona` | Shell text and teardown |

Private helpers you will likely touch:
- `sharedLinkSkipSet(mergeSessions)` — decides what is **not** symlinked. `projects`,
  `jobs`, `teams` are skipped only when sessions are separated.
- `setupSharedLinks` — links primary entries into a profile, backing up real data first.
- `mergeSessionState` / `mergeSessionFiles` / `mergeRecordDirs` — fold a profile's own
  records into the primary before linking.
- `restoreProfileAccount` — heals an account clobbered by the old credential-sharing bug.
- `checkKeychain` / `execCommand` — credential detection and process spawning.

### `format.ts`
Plain-text renderers for `list`, `doctor`, `usage` and TUI primitives. `renderDoctor`
picks suggestions from the issue kinds — extend it when you add a `DoctorIssue.kind`.

### `cli-style.ts`
Colors and box helpers. No logic.

### `installer.ts`
`resolveInstallDir` / `renderLauncher` for the packaged installer.

## TUI (`src/tui/`)

Ink/React only. Screens: `dashboard`, `use`, `doctor`, `init`, `usage` (`App.tsx`).
Components live in `components/`. Keep business logic in `service.ts`; the TUI calls
service functions and renders the result. Any new service call should handle its own
errors and surface a message rather than crash the render.

## Types (`src/types.ts`)

Shared contracts. When you add a `DoctorIssue.kind`, a `Profile` field, or a command
shape, update this file first and let TypeScript find the call sites.

## If you change X, also update Y

| Change | Also update |
|--------|-------------|
| Shared-link skip set | README "Shared environment" diagram, a tmpdir test |
| Shell integration | `core/shell.test.ts`, README "Profile switching" |
| A `DoctorIssue.kind` | `types.ts`, `format.ts` suggestions, root AGENTS golden rules if it encodes an invariant |
| A CLI flag/command | `commandFlags`, help text, README command table |
| Usage record shape | `types.ts`, `core/usage.ts`, `core/track-usage.ts`, tests |
| Registry shape | `types.ts`, `initializeRegistry`, `doctorProfiles`, `active-config` writer |
