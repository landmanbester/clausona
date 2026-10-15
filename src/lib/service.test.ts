import { describe, expect, it } from "vitest";

import { validateProfileName } from "./service.js";

describe("validateProfileName", () => {
  it("accepts ordinary profile names", () => {
    for (const name of ["work", "personal", "work-2", "client_a", "a.b"]) {
      expect(validateProfileName(name), name).toBeNull();
    }
  });

  it("rejects names that could escape the config directory", () => {
    for (const name of ["", "..", ".", "../evil", "a/b", "a\\b", "a b", "-work"]) {
      expect(validateProfileName(name), name).not.toBeNull();
    }
  });
});
