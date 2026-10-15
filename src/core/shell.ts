export function renderShellInit() {
  return `# clausona shell integration
# Read the pre-resolved active config. 'use' keeps it in sync, so launching claude
# does not pay a Node startup just to choose a profile.
_clausona_active_config() {
  local active="$HOME/.clausona/active-config"
  [[ -f "$active" ]] || return 1
  local value
  value="$(cat "$active" 2>/dev/null)"
  if [[ "$value" == "__PRIMARY__" ]]; then
    unset CLAUDE_CONFIG_DIR
  elif [[ -n "$value" ]]; then
    export CLAUDE_CONFIG_DIR="$value"
  fi
  return 0
}

# Fallback for registries written before active-config existed.
_clausona_resolve_config_slow() {
  local pfile="$HOME/.clausona/profiles.json"
  [[ -f "$pfile" ]] || return

  local result
  result=$(CLAUSONA_PROFILES="$pfile" node -e '
const fs = require("fs");
try {
  const d = JSON.parse(fs.readFileSync(process.env.CLAUSONA_PROFILES, "utf8"));
  const p = d.activeProfile || "";
  if (p && d.profiles && d.profiles[p]) {
    const profile = d.profiles[p];
    const configDir = profile.configDir || "";
    const isPrimary = profile.isPrimary || false;
    const resolved = fs.realpathSync(configDir);
    const defaultClaude = fs.realpathSync(require("os").homedir() + "/.claude");
    if (isPrimary || resolved === defaultClaude) {
      console.log("__PRIMARY__");
    } else {
      console.log(configDir);
    }
  }
} catch {}
' 2>/dev/null)
  if [[ "$result" == "__PRIMARY__" ]]; then
    unset CLAUDE_CONFIG_DIR
  elif [[ -n "$result" ]]; then
    export CLAUDE_CONFIG_DIR="$result"
  fi
}

_clausona_resolve_config() {
  _clausona_active_config || _clausona_resolve_config_slow
}

# Drop an alias with the same name so the function below is actually the one that
# runs. Without this, a user's \`alias claude=...\` silently shadows the wrapper and
# profile switching never takes effect.
unalias claude 2>/dev/null

claude() {
  local _clausona_set_cfg=0
  if [[ -z "\${CLAUDE_CONFIG_DIR:-}" ]]; then
    _clausona_resolve_config
    if [[ -n "\${CLAUDE_CONFIG_DIR:-}" ]]; then
      _clausona_set_cfg=1
    fi
  fi
  clausona _sync-plugins 2>/dev/null
  command claude "\$@"
  local rc=\$?
  # Only clear what clausona set; leave a CLAUDE_CONFIG_DIR the user exported alone.
  if [[ "\$_clausona_set_cfg" == 1 ]]; then
    unset CLAUDE_CONFIG_DIR
  fi
  clausona _track-usage 2>/dev/null
  return \$rc
}

alias csn=clausona
`;
}
