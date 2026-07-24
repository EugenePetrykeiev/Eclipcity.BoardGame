import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MAX_VOLUME_PERCENT,
  MIN_VOLUME_PERCENT,
  percentToVolume,
  volumeToPercent
} from "../../src/utils/audioVolume.js";

describe("audio volume percentage", () => {
  it("normalizes both internal maximums to 100 percent", () => {
    assert.equal(volumeToPercent(0.1, 0.1), MAX_VOLUME_PERCENT);
    assert.equal(volumeToPercent(0.5, 0.5), MAX_VOLUME_PERCENT);
  });

  it("converts the same displayed percentage for both volume scales", () => {
    assert.equal(percentToVolume(50, 0.1), 0.05);
    assert.equal(percentToVolume(50, 0.5), 0.25);
  });

  it("keeps the displayed range between 1 and 100 percent", () => {
    assert.equal(volumeToPercent(0, 0.1), MIN_VOLUME_PERCENT);
    assert.equal(volumeToPercent(2, 0.5), MAX_VOLUME_PERCENT);
    assert.equal(percentToVolume(0, 0.1), 0.001);
    assert.equal(percentToVolume(101, 0.5), 0.5);
  });
});
