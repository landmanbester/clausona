#!/usr/bin/env bash
#
# clausona installer
#
# Installs the clausona CLI and wires up shell integration.
#
#   ./install.sh                 # from a clone: uses ./dist if present, else a release
#   ./install.sh --remote        # always download a release
#   ./install.sh --local         # use the local ./dist build (run `pnpm build` first)
#   ./install.sh v0.0.4-beta     # install a specific release
#
# Remote install:
#   curl -fsSL https://raw.githubusercontent.com/landmanbester/clausona/main/install.sh | bash
#
# Environment overrides:
#   CLAUSONA_REPO         GitHub owner/repo to download releases from
#   CLAUSONA_VERSION      Release tag (default: latest)
#   CLAUSONA_URL          Exact clausona.js URL to download
#   CLAUSONA_SHA256       Expected SHA-256 of the downloaded bundle (optional)
#   CLAUSONA_APP_DIR      Where index.js is installed (default: ~/.local/share/clausona)
#   CLAUSONA_INSTALL_DIR  Where the `clausona` launcher goes (default: ~/.local/bin)
#   CLAUSONA_NO_RC        Set to 1 to skip editing your shell rc file
#
set -euo pipefail

APP_NAME="clausona"
DEFAULT_REPO="landmanbester/clausona"
REPO="${CLAUSONA_REPO:-$DEFAULT_REPO}"
APP_DIR="${CLAUSONA_APP_DIR:-${XDG_DATA_HOME:-$HOME/.local/share}/clausona}"
INSTALL_DIR="${CLAUSONA_INSTALL_DIR:-}"
VERSION="${CLAUSONA_VERSION:-latest}"
URL_OVERRIDE="${CLAUSONA_URL:-}"
SOURCE="auto"   # auto | remote | local
NO_RC="${CLAUSONA_NO_RC:-0}"

if [[ -t 1 ]]; then
  RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; CYAN=$'\033[0;36m'
  BOLD=$'\033[1m'; RESET=$'\033[0m'
else
  RED=""; GREEN=""; CYAN=""; BOLD=""; RESET=""
fi

info()  { printf '  %s\n' "$*"; }
step()  { printf '  %s\n' "$*"; }
ok()    { printf '  %s%s%s %s\n' "$GREEN" "✓" "$RESET" "$*"; }
warn()  { printf '  %s%s%s %s\n' "$CYAN" "!" "$RESET" "$*"; }
err()   { printf '  %s%s%s %s\n' "$RED" "✗" "$RESET" "$*" >&2; }

usage() {
  cat <<'EOF'

  clausona installer

  USAGE
    install.sh [version] [options]

  OPTIONS
    -v, --version <tag>   Release tag to install (default: latest)
        --repo <o/r>      GitHub owner/repo to download from
        --dir <path>      Directory for the `clausona` launcher
        --local           Use the local ./dist build (implies pnpm build already ran)
        --remote          Download a release even when a local build exists
        --no-rc           Do not modify your shell rc file
    -h, --help            Show this help

  ENVIRONMENT
    CLAUSONA_REPO, CLAUSONA_VERSION, CLAUSONA_URL, CLAUSONA_SHA256,
    CLAUSONA_APP_DIR, CLAUSONA_INSTALL_DIR, CLAUSONA_NO_RC

EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help) usage; exit 0 ;;
    -v|--version) VERSION="${2:?--version needs a value}"; shift 2 ;;
    --repo) REPO="${2:?--repo needs a value}"; shift 2 ;;
    --dir) INSTALL_DIR="${2:?--dir needs a value}"; shift 2 ;;
    --local) SOURCE="local"; shift ;;
    --remote) SOURCE="remote"; shift ;;
    --no-rc) NO_RC=1; shift ;;
    --*) err "Unknown option: $1"; usage >&2; exit 1 ;;
    *) VERSION="$1"; shift ;;
  esac
done

# ─── Preconditions ──────────────────────────────────────────────────

find_node() {
  local candidate ver
  while IFS= read -r candidate; do
    [[ -z "$candidate" ]] && continue
    ver="$("$candidate" -e 'process.stdout.write(String(process.versions.node.split(".")[0]))' 2>/dev/null || echo 0)"
    if [[ "$ver" =~ ^[0-9]+$ ]] && (( ver >= 20 )); then
      printf '%s' "$candidate"
      return 0
    fi
  done < <(type -aP node 2>/dev/null)
  return 1
}

if ! NODE_BIN="$(find_node)"; then
  err "Node.js >= 20 is required but not found."
  info "Found: $(node --version 2>/dev/null || echo none)"
  info "Install Node 20+ (nvm, nodeenv, or your package manager) and retry."
  exit 1
fi

if ! command -v claude >/dev/null 2>&1; then
  err "The Claude Code CLI ('claude') is required but not found."
  info "Install it first: https://docs.anthropic.com/en/docs/claude-code"
  exit 1
fi

# ─── Work out where the bundle comes from ───────────────────────────

SCRIPT_PATH="${BASH_SOURCE[0]:-}"
SCRIPT_DIR=""
if [[ -n "$SCRIPT_PATH" && -f "$SCRIPT_PATH" ]]; then
  SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_PATH")" && pwd)"
fi

LOCAL_BUNDLE=""
if [[ -n "$SCRIPT_DIR" ]]; then
  for candidate in "$SCRIPT_DIR/dist/clausona.js" "$SCRIPT_DIR/dist/index.js"; do
    if [[ -f "$candidate" ]]; then
      LOCAL_BUNDLE="$candidate"
      break
    fi
  done
fi

TMP_BUNDLE="$(mktemp "${TMPDIR:-/tmp}/clausona.XXXXXX")"
cleanup() { rm -f "$TMP_BUNDLE"; }
trap cleanup EXIT

fetch() {
  local url="$1"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$url" -o "$TMP_BUNDLE"
  elif command -v wget >/dev/null 2>&1; then
    wget -qO "$TMP_BUNDLE" "$url"
  else
    err "curl or wget is required to download clausona."
    exit 1
  fi
}

verify_bundle() {
  [[ -s "$TMP_BUNDLE" ]] || { err "Downloaded bundle is empty."; exit 1; }
  local first_bytes
  first_bytes="$(head -c 200 "$TMP_BUNDLE" 2>/dev/null || true)"
  if printf '%s' "$first_bytes" | grep -qiE '<!doctype html|<html'; then
    err "The download looks like an HTML page, not clausona.js."
    info "Check the repo/version, or install from source instead."
    exit 1
  fi
  if [[ -n "${CLAUSONA_SHA256:-}" ]]; then
    local actual
    if command -v sha256sum >/dev/null 2>&1; then
      actual="$(sha256sum "$TMP_BUNDLE" | awk '{print $1}')"
    elif command -v shasum >/dev/null 2>&1; then
      actual="$(shasum -a 256 "$TMP_BUNDLE" | awk '{print $1}')"
    else
      warn "CLAUSONA_SHA256 set but no sha256sum/shasum available; skipping check."
      actual="$CLAUSONA_SHA256"
    fi
    if [[ "$actual" != "$CLAUSONA_SHA256" ]]; then
      err "Checksum mismatch (expected $CLAUSONA_SHA256, got $actual)."
      exit 1
    fi
    ok "Checksum verified"
  fi
}

download_release() {
  local url
  if [[ -n "$URL_OVERRIDE" ]]; then
    url="$URL_OVERRIDE"
  elif [[ "$VERSION" == "latest" ]]; then
    url="https://github.com/$REPO/releases/latest/download/clausona.js"
  else
    url="https://github.com/$REPO/releases/download/$VERSION/clausona.js"
  fi
  step "Downloading clausona ($VERSION) from $REPO..."
  if ! fetch "$url"; then
    err "Download failed: $url"
    info "If this fork has no release yet, build from source instead:"
    info "  git clone https://github.com/$REPO.git && cd clausona && pnpm install && pnpm build && ./install.sh --local"
    exit 1
  fi
  verify_bundle
  SOURCE_DESC="$url"
}

case "$SOURCE" in
  local)
    if [[ -z "$LOCAL_BUNDLE" ]]; then
      err "No local build found. Run 'pnpm build' first, then retry."
      exit 1
    fi
    cp "$LOCAL_BUNDLE" "$TMP_BUNDLE"
    verify_bundle
    SOURCE_DESC="$LOCAL_BUNDLE (local build)"
    ;;
  remote)
    download_release
    ;;
  auto)
    if [[ -n "$URL_OVERRIDE" ]]; then
      download_release
    elif [[ -n "$LOCAL_BUNDLE" ]]; then
      cp "$LOCAL_BUNDLE" "$TMP_BUNDLE"
      verify_bundle
      SOURCE_DESC="$LOCAL_BUNDLE (local build)"
    else
      download_release
    fi
    ;;
esac

# ─── Install the bundle ─────────────────────────────────────────────

info ""
printf '  %sclausona installer%s\n\n' "$BOLD" "$RESET"
info "Using node: $NODE_BIN ($("$NODE_BIN" -e 'process.stdout.write(process.version)'))"
info "Bundle:     $SOURCE_DESC"

mkdir -p "$APP_DIR"
cp "$TMP_BUNDLE" "$APP_DIR/index.js"
chmod 0644 "$APP_DIR/index.js"
ok "Installed bundle: $APP_DIR/index.js"

# ─── Install the launcher ───────────────────────────────────────────

if [[ -z "$INSTALL_DIR" ]]; then
  if EXISTING_PATH="$(command -v "$APP_NAME" 2>/dev/null)"; then
    INSTALL_DIR="$(dirname "$EXISTING_PATH")"
  else
    INSTALL_DIR="$HOME/.local/bin"
  fi
fi

TARGET_PATH="$INSTALL_DIR/$APP_NAME"
LAUNCHER="$(mktemp "${TMPDIR:-/tmp}/clausona-launcher.XXXXXX")"
trap 'cleanup; rm -f "$LAUNCHER"' EXIT

cat > "$LAUNCHER" <<EOF
#!/usr/bin/env bash
set -euo pipefail

exec "$NODE_BIN" "$APP_DIR/index.js" "\$@"
EOF
chmod 0755 "$LAUNCHER"

if mkdir -p "$INSTALL_DIR" 2>/dev/null && cp "$LAUNCHER" "$TARGET_PATH" 2>/dev/null; then
  chmod +x "$TARGET_PATH"
  ok "Installed launcher: $TARGET_PATH"
else
  warn "$INSTALL_DIR is not writable without elevated permissions."
  if sudo mkdir -p "$INSTALL_DIR" && sudo cp "$LAUNCHER" "$TARGET_PATH"; then
    sudo chmod +x "$TARGET_PATH"
    ok "Installed launcher: $TARGET_PATH (via sudo)"
  else
    err "Could not install the launcher to $TARGET_PATH."
    info "Re-run with --dir <writable-dir> or add that dir to your PATH manually."
    exit 1
  fi
fi

if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
  warn "$INSTALL_DIR is not on your \$PATH."
  info "Add this to your shell rc: export PATH=\"$INSTALL_DIR:\$PATH\""
fi

# ─── Shell integration ──────────────────────────────────────────────

SHELL_INIT_LINE='eval "$(clausona shell-init)"'

detect_rc() {
  if [[ -n "${ZSH_VERSION:-}" || "${SHELL:-}" == */zsh ]]; then
    printf '%s' "$HOME/.zshrc"; return 0
  fi
  if [[ "${SHELL:-}" == */bash ]]; then
    printf '%s' "$HOME/.bashrc"; return 0
  fi
  if [[ -f "$HOME/.zshrc" ]]; then printf '%s' "$HOME/.zshrc"; return 0; fi
  if [[ -f "$HOME/.bashrc" ]]; then printf '%s' "$HOME/.bashrc"; return 0; fi
  return 1
}

if [[ "$NO_RC" == "1" ]]; then
  warn "Skipping shell rc changes (CLAUSONA_NO_RC=1 / --no-rc)."
  info "Add this to your shell rc yourself: $SHELL_INIT_LINE"
elif RC_FILE="$(detect_rc)"; then
  if [[ -f "$RC_FILE" ]] && grep -qF "clausona shell-init" "$RC_FILE"; then
    ok "Shell integration already present in $RC_FILE"
  else
    printf '\n%s\n' "$SHELL_INIT_LINE" >> "$RC_FILE"
    ok "Added shell integration to $RC_FILE"
  fi
else
  warn "Could not detect your shell rc file."
  info "Add this manually: $SHELL_INIT_LINE"
fi

printf '\n  %s%sDone!%s Open a new terminal, then run:\n' "$GREEN" "$BOLD" "$RESET"
printf '    %sclausona init%s\n\n' "$CYAN" "$RESET"
