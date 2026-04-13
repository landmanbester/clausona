import { describe, expect, it } from "vitest";

import { claudeJsonPathForConfigDir, keychainServiceForConfigDir } from "./paths.js";

describe("paths", () => {
  it("uses ~/.claude.json for the primary config dir", () => {
    expect(
      claudeJsonPathForConfigDir({
        homeDir: "/Users/test",
        configDir: "/Users/test/.claude",
      }),
    ).toBe("/Users/test/.claude.json");
  });

  it("uses config-local .claude.json for custom config dirs", () => {
    expect(
      claudeJsonPathForConfigDir({
        homeDir: "/Users/test",
        configDir: "/Users/test/.claude-work",
      }),
    ).toBe("/Users/test/.claude-work/.claude.json");
  });

  it("uses the default keychain service for the primary config dir", () => {
    expect(
      keychainServiceForConfigDir({
        homeDir: "/Users/test",
        configDir: "/Users/test/.claude",
      }),
    ).toBe("Claude Code-credentials");
  });

  it("uses a hashed keychain service for custom config dirs", () => {
    expect(
      keychainServiceForConfigDir({
        homeDir: "/Users/test",
        configDir: "/Users/test/.claude-work",
      }),
    ).toMatch(/^Claude Code-credentials-[a-f0-9]{8}$/);
  });

  it("resolves json path for Linux-style primary config", () => {
    expect(
      claudeJsonPathForConfigDir({
        homeDir: "/home/testuser",
        configDir: "/home/testuser/.claude",
      }),
    ).toBe("/home/testuser/.claude.json");
  });

  it("resolves json path for Linux-style custom config", () => {
    expect(
      claudeJsonPathForConfigDir({
        homeDir: "/home/testuser",
        configDir: "/home/testuser/.claude-work",
      }),
    ).toBe("/home/testuser/.claude-work/.claude.json");
  });

  it("resolves keychain service for Linux-style primary config", () => {
    expect(
      keychainServiceForConfigDir({
        homeDir: "/home/testuser",
        configDir: "/home/testuser/.claude",
      }),
    ).toBe("Claude Code-credentials");
  });

  it("resolves keychain service for Linux-style custom config", () => {
    const result = keychainServiceForConfigDir({
      homeDir: "/home/testuser",
      configDir: "/home/testuser/.claude-work",
    });
    expect(result).toMatch(/^Claude Code-credentials-[a-f0-9]{8}$/);
  });
});
