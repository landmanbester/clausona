import { homedir } from "node:os";
import path from "node:path";
import { realpath } from "node:fs/promises";

import { claudeJsonPathForConfigDir } from "./paths.js";
import { readJson, withFileLock, writeJson } from "./store.js";
import type { Registry, UsageStore } from "../types.js";

const CLAUSONA_DIR = path.join(homedir(), ".clausona");
const REGISTRY_PATH = path.join(CLAUSONA_DIR, "profiles.json");
const USAGE_PATH = path.join(CLAUSONA_DIR, "usage.json");

async function claudeJsonPathForProfile(configDir: string): Promise<string> {
  const home = homedir();
  const defaultClaude = await realpath(path.join(home, ".claude")).catch(() => path.join(home, ".claude"));
  const resolved = await realpath(configDir).catch(() => configDir);
  const dir = resolved === defaultClaude ? path.join(home, ".claude") : configDir;
  return claudeJsonPathForConfigDir({ homeDir: home, configDir: dir });
}

async function projectsFromConfig(configDir: string) {
  const cdata = await readJson<Record<string, unknown>>(await claudeJsonPathForProfile(configDir), {});
  return cdata.projects as Record<string, Record<string, unknown>> | undefined;
}

/**
 * Track usage for the given profile (or the active profile if not specified).
 * Reads .claude.json, compares fingerprints to detect new/changed usage,
 * and appends records to usage.json.
 */
export async function trackUsage(profileName?: string): Promise<void> {
  const registry = await readJson<Registry | null>(REGISTRY_PATH, null);
  if (!registry) return;

  const name = profileName ?? registry.activeProfile;
  if (!name || !registry.profiles[name]) return;

  const profile = registry.profiles[name];
  const configDir = profile.configDir;
  if (!configDir) return;

  const projects = await projectsFromConfig(configDir);
  if (!projects) return;

  const now = new Date();
  const tz = getTimezoneOffset(now);
  // Format: 2026-03-07T21:00:00+09:00 (matches shell hook's isoformat with seconds precision)
  const pad = (n: number) => String(n).padStart(2, "0");
  const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}${tz}`;

  // Serialise the read-modify-write so two sessions finishing at once cannot drop
  // each other's records.
  await withFileLock(USAGE_PATH, async () => {
    const usage = await readJson<UsageStore>(USAGE_PATH, {});

    if (!usage[name]) {
      usage[name] = { records: [], seenSessions: {} };
    }

    const prof = usage[name];
    if (!prof.seenSessions) {
      prof.seenSessions = {};
    }
    const seen = prof.seenSessions;

    let changed = false;

    for (const [projPath, projData] of Object.entries(projects)) {
      if (!projData || typeof projData !== "object") continue;

      const fp = buildFingerprint(projData);
      if (!fp) continue;
      if (seen[projPath] === fp) continue;

      const cost = (projData.lastCost as number) ?? 0;
      const inputTokens = (projData.lastTotalInputTokens as number) ?? 0;
      const outputTokens = (projData.lastTotalOutputTokens as number) ?? 0;

      seen[projPath] = fp;
      prof.records.push({
        ts,
        tz,
        cost: Math.round(cost * 1e6) / 1e6,
        inputTokens,
        outputTokens,
      });
      changed = true;
    }

    if (changed) {
      await writeJson(USAGE_PATH, usage);
    }
  });
}

function buildFingerprint(projData: Record<string, unknown>): string | null {
  const sid = (projData.lastSessionId as string) ?? "";
  const cost = (projData.lastCost as number) ?? 0;
  if (!sid || !cost || cost <= 0) return null;
  const inputTokens = (projData.lastTotalInputTokens as number) ?? 0;
  const outputTokens = (projData.lastTotalOutputTokens as number) ?? 0;
  const duration = (projData.lastDuration as number) ?? 0;
  return `${sid}:${cost}:${inputTokens}:${outputTokens}:${duration}`;
}

/**
 * Seed seenSessions with current fingerprints so that pre-existing usage
 * is not recorded when tracking starts. Call this when initializing or adding a profile.
 */
export async function seedSeenSessions(profileName: string, configDir: string): Promise<void> {
  const projects = await projectsFromConfig(configDir);
  if (!projects) return;

  await withFileLock(USAGE_PATH, async () => {
    const usage = await readJson<UsageStore>(USAGE_PATH, {});
    if (!usage[profileName]) {
      usage[profileName] = { records: [], seenSessions: {} };
    }
    const seen = (usage[profileName].seenSessions ??= {});

    let changed = false;
    for (const [projPath, projData] of Object.entries(projects)) {
      if (!projData || typeof projData !== "object") continue;
      const fp = buildFingerprint(projData);
      if (!fp || seen[projPath]) continue;
      seen[projPath] = fp;
      changed = true;
    }

    if (changed) {
      await writeJson(USAGE_PATH, usage);
    }
  });
}

function getTimezoneOffset(date: Date): string {
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const h = String(Math.floor(Math.abs(offset) / 60)).padStart(2, "0");
  const m = String(Math.abs(offset) % 60).padStart(2, "0");
  return `${sign}${h}:${m}`;
}
