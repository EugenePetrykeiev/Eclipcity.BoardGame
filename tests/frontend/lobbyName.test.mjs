import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  defaultLobbyName,
  hasAllowedLobbyNameCharacters,
  validateLobbyName
} from "../../src/utils/lobbyName.js";

describe("lobby name validation", () => {
  it("keeps an empty name valid for the default lobby name", () => {
    const result = validateLobbyName("   ");

    assert.equal(defaultLobbyName, "Untitled lobby");
    assert.equal(result.isValid, true);
    assert.equal(result.message, "");
  });

  it("allows latin, ukrainian, digits, spaces, and approved symbols", () => {
    assert.equal(hasAllowedLobbyNameCharacters("Run#7"), true);
    assert.equal(hasAllowedLobbyNameCharacters("Київ 2150!"), true);
    assert.equal(hasAllowedLobbyNameCharacters("A/B|C?`~"), true);
  });

  it("rejects unsupported symbols", () => {
    assert.equal(hasAllowedLobbyNameCharacters("bad_name"), false);
    assert.equal(validateLobbyName("bad_name").isValid, false);
  });

  it("rejects names outside the configured length bounds", () => {
    assert.equal(validateLobbyName("abcdefghijklmno").isValid, true);
    assert.equal(validateLobbyName("ab").isValid, false);
    assert.equal(validateLobbyName("abcdefghijklmnop").isValid, false);
  });

  it("uses caller-provided translated validation messages", () => {
    const result = validateLobbyName("ab", { min: "too short" });

    assert.equal(result.isValid, false);
    assert.equal(result.message, "too short");
  });
});
