import { lstat, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Small filesystem/JSON helpers shared by the registry, the usage store and the
 * plugin sync. Keeping them in one place means every writer gets the same
 * crash-safety guarantees.
 */

export async function exists(targetPath: string): Promise<boolean> {
  try {
    await lstat(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function readJson<T>(targetPath: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(targetPath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * Write JSON atomically: a sibling temp file is written and then renamed over the
 * target. A crash or a concurrent reader can then never observe a half-written
 * registry or usage store, which was possible with a bare `writeFile`.
 */
export async function writeJson(targetPath: string, value: unknown): Promise<void> {
  await atomicWrite(targetPath, `${JSON.stringify(value, null, 2)}\n`);
}

/**
 * Like {@link writeJson} but skips the write (and its rename) when the on-disk bytes
 * already match. `syncPluginsJson` runs before every `claude` launch, so avoiding a
 * no-op rewrite keeps that hot path cheap.
 */
export async function writeJsonIfChanged(targetPath: string, value: unknown): Promise<boolean> {
  const data = `${JSON.stringify(value, null, 2)}\n`;
  try {
    if ((await readFile(targetPath, "utf8")) === data) return false;
  } catch {
    // missing or unreadable — fall through and write it
  }
  await atomicWrite(targetPath, data);
  return true;
}

export async function atomicWrite(targetPath: string, data: string): Promise<void> {
  await mkdir(path.dirname(targetPath), { recursive: true });
  const tmp = `${targetPath}.${process.pid}.${Date.now()}.tmp`;
  try {
    await writeFile(tmp, data, "utf8");
    await rename(tmp, targetPath);
  } catch (error) {
    await rm(tmp, { force: true }).catch(() => {});
    throw error;
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Best-effort cross-process mutex built on `mkdir` atomicity (Node has no flock).
 * Used to serialise read-modify-write cycles on `profiles.json` and `usage.json`
 * so two `claude` sessions finishing at once cannot drop each other's records.
 *
 * A lock older than `staleMs` is treated as abandoned and reclaimed, so a crashed
 * process can never wedge the CLI. On timeout the work still runs — a lock is an
 * optimisation for correctness, not a reason to fail the user's command.
 */
export async function withFileLock<T>(
  lockTarget: string,
  fn: () => Promise<T>,
  options: { timeoutMs?: number; staleMs?: number } = {},
): Promise<T> {
  const lockDir = `${lockTarget}.lock`;
  const timeoutMs = options.timeoutMs ?? 2_000;
  const staleMs = options.staleMs ?? 30_000;
  const deadline = Date.now() + timeoutMs;

  let locked = false;
  while (!locked) {
    try {
      await mkdir(lockDir);
      locked = true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
        // The filesystem refuses the lock (read-only, etc). Do the work unlocked
        // rather than blocking the command.
        return fn();
      }
      const info = await stat(lockDir).catch(() => null);
      if (info && Date.now() - info.mtimeMs > staleMs) {
        await rm(lockDir, { force: true, recursive: true }).catch(() => {});
        continue;
      }
      if (Date.now() > deadline) return fn();
      await sleep(15);
    }
  }

  try {
    return await fn();
  } finally {
    await rm(lockDir, { force: true, recursive: true }).catch(() => {});
  }
}
