# clausona

**Switch between multiple Claude Code accounts on one machine — plugins, MCP servers, and settings stay shared.**

<p align="center">
  <img src="assets/dashboard.png" alt="clausona dashboard" width="700" />
</p>

```bash
csn use work     # switch to your work account — done
```

No re-login. No reinstalling plugins. Just switch and go.

clausona keeps one config directory per account and symlinks the parts you want to share
(MCP servers, plugins, settings), while keeping the parts you don't (credentials, session
history by default). It is a single shell hook and a handful of symlinks — no daemon, no
proxy, no patched Claude Code.

> New here? Jump to [Quick start](#quick-start). Contributors and AI agents: read
> [`CONTRIBUTING.md`](CONTRIBUTING.md) and [`AGENTS.md`](AGENTS.md).

---

## Why

You have multiple Claude Code accounts (personal, work, different orgs), but switching
between them on a single machine is tedious:

- **Switching is manual.** You have to log out, log back in, or juggle
  `CLAUDE_CONFIG_DIR` yourself.
- **Settings don't carry over.** Each account gets its own config directory, so your MCP
  servers, plugins, permissions, and settings have to be set up from scratch — every time.

clausona fixes both. One command switches the account; everything else carries over.

## Features

- **One-command switching** — `clausona use <name>` and you're on a different account.
- **Shared environment** — MCP servers, plugins, permissions, skills and settings are
  symlinked across profiles. Set up once, use everywhere.
- **Isolated credentials** — each profile keeps its own login, so accounts never spend
  each other's quota.
- **Context that follows you** — with `--merge-sessions`, `projects/`, `jobs/` and
  `teams/` are shared so `/resume` and background sessions carry across accounts.
- **Pure Claude Code** — no wrapping, no proxying, no background process. Fully
  compatible with oh-my-claudecode, Cline, and any other tool in your stack.
- **Usage tracking** — per-profile cost and token usage, recorded locally.
- **Interactive dashboard** — a TUI for managing profiles, viewing usage, and health
  checks.

## Requirements

- **Node.js >= 20**
- **[Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code)** (`claude` on your `PATH`)
- **macOS or Linux**, using **bash or zsh**

## Install

There are two ways to install: run the bundled installer, or place the built files by
hand. The installer is the easy path and works on macOS and Linux with bash or zsh.

### 1. Run the installer (recommended)

From a clone — this builds and installs in one step:

```bash
git clone https://github.com/landmanbester/clausona.git
cd clausona
pnpm install
./install.sh            # uses ./dist if built, otherwise downloads a release
```

The installer will:

- install the CLI bundle to `~/.local/share/clausona/index.js`,
- write a `clausona` launcher to `~/.local/bin` (or to the directory it is already
  installed in),
- append `eval "$(clausona shell-init)"` to your `~/.zshrc` or `~/.bashrc`.

Open a new terminal and run `clausona init`.

Once a release is published on the repo, colleagues can install without cloning:

```bash
curl -fsSL https://raw.githubusercontent.com/landmanbester/clausona/main/install.sh | bash
```

> If the fork has no release yet, the remote installer will tell you to build from
> source — use the clone-and-`./install.sh` flow above in that case.

#### Installer options

| Option / environment variable | Effect |
| --- | --- |
| `./install.sh --local` | Use the local `./dist` build (run `pnpm build` first) |
| `./install.sh --remote` | Download a release even when a local build exists |
| `./install.sh v0.0.4-beta` | Install a specific release tag |
| `./install.sh --repo <owner/repo>` | Download releases from a different fork |
| `./install.sh --dir <path>` | Where to put the `clausona` launcher |
| `./install.sh --no-rc` | Do not modify your shell rc file |
| `CLAUSONA_URL=<url>` | Download `clausona.js` directly from a URL |
| `CLAUSONA_SHA256=<hash>` | Verify the downloaded bundle's checksum |
| `CLAUSONA_APP_DIR` / `CLAUSONA_INSTALL_DIR` | Override install locations |

Run `./install.sh --help` for the full list.

### 2. Install the built bundle manually

If you would rather not run the installer:

```bash
git clone https://github.com/landmanbester/clausona.git
cd clausona
pnpm install
pnpm build

mkdir -p ~/.local/share/clausona ~/.local/bin
cp dist/index.js ~/.local/share/clausona/index.js

cat > ~/.local/bin/clausona <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
exec node ~/.local/share/clausona/index.js "$@"
EOF
chmod +x ~/.local/bin/clausona

# then add the shell integration
echo 'eval "$(clausona shell-init)"' >> ~/.zshrc   # or ~/.bashrc
```

Re-run `cp dist/index.js ~/.local/share/clausona/index.js` after each `pnpm build` to
update your installed copy.

### Platform notes

- **Linux:** install Node.js >= 20 first (via `nvm`, `nodeenv`, or your distro package).
  Bash users get the shell line in `~/.bashrc`.
- **Updating:** re-run `./install.sh`, or copy the new `dist/index.js` over
  `~/.local/share/clausona/index.js`.
- **No release yet?** `./install.sh --local` always works from a clone; the remote
  one-liner needs a published release (see [Cutting a release](#cutting-a-release)).

## Quick start

```bash
clausona init        # 1. discover your existing Claude Code accounts
clausona use work    # 2. switch to a profile
clausona list        # 3. see all profiles with usage
clausona             # open the interactive dashboard
```

`csn` is a shorthand alias for `clausona`, registered by the shell integration.

After `init`, profiles are discovered from `~/.claude` plus any `~/.claude-*`
directories. The primary account is registered as `default`; others take their directory
suffix as the name (`~/.claude-work` → `work`).

## Commands

| Command | Description |
|---------|-------------|
| `clausona` | Interactive TUI dashboard |
| `clausona init [--auto] [--merge-sessions]` | Discover and register Claude Code accounts |
| `clausona add <name> [--from <path>] [--merge-sessions]` | Add a profile manually |
| `clausona remove <name>` | Remove a profile |
| `clausona use [name]` | Switch active profile (opens a picker if omitted) |
| `clausona run <profile> [-- claude-args...]` | Run Claude Code with a specific profile |
| `clausona list [--json]` | List all profiles with usage |
| `clausona usage [name] [--period=today\|week\|month\|all] [--json]` | View cost and token usage |
| `clausona current [--json]` | Show the active profile |
| `clausona config <name> --merge-sessions \| --separate-sessions` | Configure session mode |
| `clausona doctor [--json]` | Check profile health |
| `clausona repair <name>` | Fix broken shared links and restore an overwritten account |
| `clausona login <name>` | Re-authenticate a profile |
| `clausona shell-init` | Print the shell integration (used in your rc file) |
| `clausona uninstall` | Uninstall clausona completely |

Every command supports `--help`.

## How it works

### Profile switching

The shell integration (`eval "$(clausona shell-init)"`) defines a `claude()` wrapper:

1. **Before** `claude` runs, it reads `~/.clausona/active-config` — a tiny, pre-resolved
   copy of the active profile's config dir, kept in sync by `clausona use` — and exports
   `CLAUDE_CONFIG_DIR`. If that file is missing it falls back to parsing
   `profiles.json`. A `CLAUDE_CONFIG_DIR` you exported yourself is left untouched.
2. **After** `claude` exits, it records any new cost/token usage for that profile.

```
clausona use work
        ↓
claude                 ← wrapper sets CLAUDE_CONFIG_DIR, then runs claude
        ↓
_track-usage           ← on exit, records new usage
```

There is no daemon and no long-running process; the wrapper is plain shell.

### Shared environment

When you register a profile, clausona links shared resources from your primary
`~/.claude` into the profile's config directory:

```
~/.claude-work/            (new profile)
├── .claude.json           ← own account metadata (NOT shared)
├── .credentials.json      ← own OAuth tokens outside macOS (NOT shared)
├── projects/              ← own session history (NOT shared by default)
├── jobs/                  ← own background sessions (follows projects/)
├── teams/                 ← own team records (follows projects/)
├── mcp-servers/  →  ~/.claude/mcp-servers    (symlink to primary)
├── plugins/      →  ~/.claude/plugins        (symlink to primary)
├── settings.json →  ~/.claude/settings.json  (symlink to primary)
└── ...
```

**Credentials are never shared.** On Linux and Windows Claude Code stores OAuth tokens
in `.credentials.json`; sharing that file would make every profile authenticate as the
primary. If an older profile was created before this was fixed, `clausona doctor`
reports it and `clausona repair <name>` restores the profile's own account from its
backup (you may then need `clausona login <name>` to refresh the token).

**Session separation is the default.** Each profile keeps its own `projects/`, `jobs/`
and `teams/`, so `/resume` and the background-session list only show that profile's
conversations. Pass `--merge-sessions` when adding/initializing to share them across
profiles. `jobs/` and `teams/` always follow `projects/` so a background session and its
transcript stay together.

### Data storage

Everything stays local:

```
~/.clausona/
├── profiles.json    # registered profiles and active selection
├── active-config    # pre-resolved config dir for the claude shell wrapper
├── usage.json       # per-profile usage history
└── backups/         # backups of imported profile directories

~/.claude-<name>/    # profile config directories (created by `clausona add`)
```

### Linux credential detection

clausona discovers accounts by checking, in order:

1. **`secret-tool`** (from `libsecret-tools`) — the system keyring.
2. **`.credentials.json`** — the plain-file credential Claude Code writes on login.

If your credentials live in `.credentials.json` (the Linux default), you need no extra
setup. To use the system keyring instead, install `libsecret-tools` and store each
credential. The **primary** (`~/.claude`) uses a fixed service name:

```bash
secret-tool store --label "Claude Code" service "Claude Code-credentials" \
  <<< "$(cat ~/.claude/.credentials.json)"
```

**Non-primary** profiles use a hashed service name:

```bash
# compute the hash for ~/.claude-work
node -e "const h=require('crypto').createHash('sha256').update('$HOME/.claude-work').digest('hex').slice(0,8); console.log('Claude Code-credentials-'+h)"

# then store it (replace <hash> with the output)
secret-tool store --label "Claude Code (work)" service "Claude Code-credentials-<hash>" \
  <<< "$(cat ~/.claude-work/.credentials.json)"
```

## Troubleshooting

**`clausona use <name>` says it switched, but Claude still uses the other account.**
Run `clausona doctor`. The usual causes:
- A stale shared credential — `clausona repair <name>` and then `clausona login <name>`.
- `ANTHROPIC_API_KEY` is exported in your shell. When set, Claude Code uses that key and
  ignores per-profile OAuth credentials. Unset it (or scope it to where you need it) if
  you want account switching by profile.

**`clausona: command not found`.** `~/.local/bin` (or wherever it installed) isn't on
your `PATH`, or you haven't opened a new terminal since installing.

**The shell hook isn't active.** Confirm `eval "$(clausona shell-init)"` is in
`~/.zshrc`/`~/.bashrc` and open a new terminal. Verify with `type claude` — it should be
a shell function.

**`clausona doctor` reports broken or missing shared links.** Run
`clausona repair <name>`. This re-creates links, folds local session records back into
the primary, and restores an overwritten account from the profile backup.

**Credentials expired / "OAuth session expired".** Run `clausona login <name>` to sign
in again.

**Node version error on install.** clausona needs Node >= 20. Check
`node --version`; upgrade via `nvm install 20` or your package manager.

## Development

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the full guide. The short version:

```bash
pnpm install        # install dependencies
pnpm test           # run the test suite (vitest)
pnpm typecheck      # tsc --noEmit
pnpm build          # bundle to dist/index.js (esbuild)
pnpm test:watch     # watch mode
```

To run your build as the real CLI:

```bash
pnpm build
node dist/index.js --help
# or install it (see "Install from source") and use `clausona`
```

### Project layout

| Path | Responsibility |
|------|----------------|
| `src/index.tsx` | Process entry point; parses argv and dispatches to the CLI or TUI |
| `src/commands.ts` | Command parsing, help text, and `runCommand` |
| `src/lib/service.ts` | Core logic: discovery, profiles, shared links, repair, login |
| `src/core/` | Building blocks: paths, atomic JSON store, usage, tracking, doctor, registry, shell |
| `src/lib/` | Formatting, terminal styling, installer helpers |
| `src/tui/` | Ink/React interactive dashboard and components |
| `src/types.ts` | Shared TypeScript types |
| `install.sh` | Packaged-release installer |
| `.github/workflows/release.yml` | Builds and publishes releases on `v*` tags |

Tests are colocated next to the code as `*.test.ts` / `*.test.tsx`.

### Cutting a release

The release workflow runs on tags matching `v*`:

```bash
# bump the version in package.json first
git tag v0.0.4-beta
git push origin v0.0.4-beta
```

CI builds, tests, and uploads `clausona.js` plus `install.sh` to the GitHub release.
After the release is published, the remote installer one-liner in
[Install](#install) starts working for colleagues, and `./install.sh` can fetch that
tag instead of using a local build.

## Contributing

Issues and pull requests are welcome. Please run `pnpm typecheck && pnpm test` before
opening a PR, and read [`CONTRIBUTING.md`](CONTRIBUTING.md).

AI agents should start with [`AGENTS.md`](AGENTS.md).

## License

MIT — see [`LICENSE`](LICENSE).
