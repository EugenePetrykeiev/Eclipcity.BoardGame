import assert from "node:assert/strict";
import fs from "node:fs";
import { describe, it } from "node:test";
import { deTranslations } from "../../src/i18n/de.js";

const providerSource = fs.readFileSync(
  new URL("../../src/i18n/I18nProvider.jsx", import.meta.url),
  "utf8"
);
const gamePageSource = fs.readFileSync(
  new URL("../../src/pages/GamePage.jsx", import.meta.url),
  "utf8"
);
const gameStyles = fs.readFileSync(
  new URL("../../src/styles/game-page.css", import.meta.url),
  "utf8"
);
const publicInterfaceSources = [
  "../../src/App.jsx",
  "../../src/pages/HomePage.jsx",
  "../../src/components/layout/Header.jsx",
  "../../src/components/home/GameVisual.jsx",
  "../../src/components/auth/AuthPanel.jsx"
].map((path) =>
  fs.readFileSync(new URL(path, import.meta.url), "utf8")
);

function localeKeys(startMarker, endMarker) {
  const start = providerSource.indexOf(startMarker);
  const end = providerSource.indexOf(endMarker, start);
  assert.notEqual(start, -1, startMarker);
  assert.notEqual(end, -1, endMarker);
  return [
    ...providerSource
      .slice(start, end)
      .matchAll(/^\s+"([^"]+)":/gm)
  ].map((match) => match[1]);
}

describe("interface translations", () => {
  it("keeps Ukrainian, English, and German translation keys aligned", () => {
    const ukKeys = localeKeys("  uk: {", "  en: {");
    const enKeys = localeKeys("  en: {", "  de: deTranslations");
    const deKeys = Object.keys(deTranslations);

    assert.deepEqual([...enKeys].sort(), [...ukKeys].sort());
    assert.deepEqual([...deKeys].sort(), [...enKeys].sort());
  });

  it("uses translated game controls instead of hardcoded Ukrainian labels", () => {
    assert.match(gamePageSource, /t\("gamePage\.endTurn"\)/);
    assert.doesNotMatch(gamePageSource, /Завершити хід/);
    assert.doesNotMatch(gamePageSource, /[А-Яа-яІіЇїЄє]/);
  });

  it("keeps the public interface free of hardcoded Ukrainian copy", () => {
    for (const source of publicInterfaceSources) {
      assert.doesNotMatch(source, /[А-Яа-яІіЇїЄє]/);
    }
  });
});

describe("board prisoner stacking", () => {
  it("keeps board prisoners above hovered tiles", () => {
    const tileZIndex = Number(
      gameStyles.match(/\.tunnel-tile:hover\s*\{\s*z-index:\s*(\d+)/)?.[1]
    );
    const prisonerZIndex = Number(
      gameStyles.match(/\.board-prisoner\s*\{\s*z-index:\s*(\d+)/)?.[1]
    );

    assert.ok(tileZIndex > 0);
    assert.ok(prisonerZIndex > tileZIndex);
  });
});
