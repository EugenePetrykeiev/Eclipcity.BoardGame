import assert from "node:assert/strict";
import fs from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { cardBackImage, gameItems } from "../../src/assets/game/gameAssets.js";

function assetExists(assetUrl) {
  return fs.existsSync(fileURLToPath(assetUrl));
}

describe("game asset manifest", () => {
  it("matches the 9 item, 45 tile, 108 card rules", () => {
    assert.equal(gameItems.length, 9);
    assert.equal(
      gameItems.reduce((sum, item) => sum + item.boardCopies, 0),
      45
    );
    assert.equal(
      gameItems.reduce((sum, item) => sum + item.deckCopies, 0),
      108
    );
  });

  it("has stable unique item ids", () => {
    const ids = gameItems.map((item) => item.id);

    assert.equal(new Set(ids).size, ids.length);
  });

  it("points to existing item, card, and back images", () => {
    assert.equal(assetExists(cardBackImage), true);

    for (const item of gameItems) {
      assert.equal(assetExists(item.itemImage), true, item.itemImage);
      assert.equal(assetExists(item.cardImage), true, item.cardImage);
    }
  });
});
