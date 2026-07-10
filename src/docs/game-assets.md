# Game Assets

Цей документ описує перший набір bitmap-асетів для запуску гри Eclipcity.
Асети створені в стилі `Neon Wet Asphalt` з
`context/cyberpunk-color-palette-spec.md`.

## Rules Mapping

У грі є 9 типів предметів:

1. Neural implant / Імплант
2. Screen terminal / Екран
3. Memory drive / Флешка пам'яті
4. Power battery / Акумулятор живлення
5. Whiskey bottle / Пляшка віскі
6. Cryptocurrency access card / Криптокарта
7. Stun pistol / Електрошоковий пістолет
8. Hand-drawn tunnel map / Карта місцевості
9. Movement-boosting shoes / Взуття з прискорювачами

Кожен предмет має:

- `5` копій на маршруті з 45 тайлів;
- `12` карт у спільній колоді з 108 карт.

## File Structure

```text
src/assets/game/
  cards/
    card-back.png
    *-card.png
  items/
    *.png
  reference/
    card-back-reference.png
  sheets/
    card-faces-atlas.png
    item-art-atlas.png
  gameAssets.js
```

## Usage

Фронтенд може імпортувати готовий маніфест:

```js
import { cardBackImage, gameItems } from "../assets/game/gameAssets.js";
```

`gameItems` містить:

- `id` - стабільний технічний ідентифікатор;
- `nameEn` / `nameUk` - назви для UI;
- `boardCopies` - кількість символів предмета на маршруті;
- `deckCopies` - кількість карт цього предмета в колоді;
- `itemImage` - окремий item-art;
- `cardImage` - лицьова карта з предметом.

## Generation Notes

Асети були згенеровані через built-in `image_gen` як три зображення:

- 3x3 item-art atlas;
- 3x3 card-face atlas;
- окрема card back.

Після цього атласи були розрізані на окремі PNG-файли 418x418. Оригінальні
атласи залишені в `sheets/` як source-of-truth для повторного кропу або
порівняння стилю.

## Prompt Summary

Загальні вимоги до генерації:

- cyberpunk-noir tabletop card game;
- темний wet asphalt фон;
- cyan neon circuit glow;
- magenta/violet accents;
- tiny Toxic Lime accents;
- no readable text, no logos, no watermarks;
- предмети мають бути впізнавані в маленькому розмірі.
