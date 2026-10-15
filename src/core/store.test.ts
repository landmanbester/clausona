import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { exists, readJson, withFileLock, writeJson, writeJsonIfChanged } from "./store.js";

const temps: string[] = [];
function scratch() {
  const dir = mkdtempSync(path.join(tmpdir(), "clausona-store-"));
  temps.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("store", () => {
  it("reads JSON and falls back when the file is missing or corrupt", async () => {
    const dir = scratch();
    const good = path.join(dir, "good.json");
    const bad = path.join(dir, "bad.json");
    writeFileSync(good, '{"a":1}');
    writeFileSync(bad, "{not json");

    expect(await readJson(good, {})).toEqual({ a: 1 });
    expect(await readJson(path.join(dir, "missing.json"), { fallback: true })).toEqual({ fallback: true });
    expect(await readJson(bad, { fallback: true })).toEqual({ fallback: true });
  });

  it("writes atomically and leaves no temp files behind", async () => {
    const dir = scratch();
    const target = path.join(dir, "nested", "data.json");
    await writeJson(target, { hello: "world" });

    expect(await exists(target)).toBe(true);
    expect(readFileSync(target, "utf8")).toBe('{\n  "hello": "world"\n}\n');
    expect(readdirSync(path.dirname(target))).toEqual(["data.json"]);
  });

  it("only rewrites when the bytes change", async () => {
    const dir = scratch();
    const target = path.join(dir, "data.json");

    expect(await writeJsonIfChanged(target, { a: 1 })).toBe(true);
    expect(await writeJsonIfChanged(target, { a: 1 })).toBe(false);
    expect(await writeJsonIfChanged(target, { a: 2 })).toBe(true);
  });

  it("serialises concurrent read-modify-write cycles with a lock", async () => {
    const dir = scratch();
    const target = path.join(dir, "counter.json");
    await writeJson(target, { value: 0 });

    const bump = () =>
      withFileLock(target, async () => {
        const current = await readJson(target, { value: 0 });
        await new Promise((resolve) => setTimeout(resolve, 10));
        await writeJson(target, { value: current.value + 1 });
      });

    await Promise.all([bump(), bump(), bump(), bump()]);

    expect(await readJson(target, { value: 0 })).toEqual({ value: 4 });
    expect(readdirSync(dir)).toEqual(["counter.json"]);
  });

  it("does not leave a lock behind when the work throws", async () => {
    const dir = scratch();
    const target = path.join(dir, "data.json");

    await expect(
      withFileLock(target, async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    expect(readdirSync(dir)).toEqual([]);
  });
});
