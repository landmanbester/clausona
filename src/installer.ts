import path from "node:path";

export function resolveInstallDir({
  existingPath,
  homeDir,
}: {
  existingPath: string | null;
  homeDir: string;
}) {
  if (existingPath) {
    return path.dirname(existingPath);
  }

  return path.join(homeDir, ".local", "bin");
}

export function renderLauncher({ appDir, nodeBin = "node" }: { appDir: string; nodeBin?: string }) {
  return `#!/usr/bin/env bash
set -euo pipefail

exec "${nodeBin}" "${appDir}/index.js" "$@"
`;
}
