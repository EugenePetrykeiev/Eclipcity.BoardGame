import assert from "node:assert/strict";
import fs from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  cardBackImage,
  gameItems,
  prisonerPawnImage
} from "../../src/assets/game/gameAssets.js";

function assetExists(assetUrl) {
  return fs.existsSync(fileURLToPath(assetUrl));
}

function assetSize(assetUrl) {
  return fs.statSync(fileURLToPath(assetUrl)).size;
}

const cursorFiles = [
  "arrow.cur",
  "cross.cur",
  "link.cur",
  "move.cur",
  "no.cur"
];

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
    assert.equal(assetExists(prisonerPawnImage), true);

    for (const item of gameItems) {
      assert.equal(assetExists(item.itemImage), true, item.itemImage);
      assert.equal(assetExists(item.cardImage), true, item.cardImage);
    }
  });

  it("does not point to empty or failed black crop images", () => {
    for (const item of gameItems) {
      assert.ok(assetSize(item.itemImage) > 100_000, item.itemImage);
      assert.ok(assetSize(item.cardImage) > 100_000, item.cardImage);
    }
  });

  it("keeps gameplay cursor assets in source control", () => {
    const cursorDir = new URL("../../src/assets/cursors/", import.meta.url);

    for (const cursorFile of cursorFiles) {
      const cursorPath = fileURLToPath(new URL(cursorFile, cursorDir));

      assert.equal(fs.existsSync(cursorPath), true, cursorPath);
    }
  });
});
