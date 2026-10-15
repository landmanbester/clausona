import { describe, expect, it } from "vitest";

import { renderShellInit } from "./shell.js";

describe("renderShellInit", () => {
  it("includes the claude wrapper function and alias", () => {
    const shellInit = renderShellInit();

    expect(shellInit).toContain("claude()");
    expect(shellInit).toContain("alias csn=clausona");
    expect(shellInit).toContain("CLAUDE_CONFIG_DIR");
    expect(shellInit).toContain("_clausona_resolve_config");
    expect(shellInit).toContain("_track-usage");
  });

  it("reads the cached active config before falling back to node", () => {
    const shellInit = renderShellInit();

    expect(shellInit).toContain("active-config");
    expect(shellInit).toContain("_clausona_active_config");
    expect(shellInit).toContain("_clausona_resolve_config_slow");
  });

  it("unaliases claude so the wrapper cannot be shadowed", () => {
    expect(renderShellInit()).toContain("unalias claude");
  });

  it("only unsets CLAUDE_CONFIG_DIR when it set it itself", () => {
    const shellInit = renderShellInit();

    expect(shellInit).toContain("_clausona_set_cfg");
    expect(shellInit).toContain('if [[ "$_clausona_set_cfg" == 1 ]]');
  });
});
