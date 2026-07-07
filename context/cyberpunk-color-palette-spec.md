# Cyberpunk Game Website — Color Palette Specification

**Концепція:** "Neon Wet Asphalt" — темний UI з неоновими акцентами, натхненний нічним кіберпанк-містом.
**Призначення:** веб-сайт гри в стилі кіберпанк, сучасний UI/UX (dark mode, доступність, ієрархія акцентів).

---

## 1. Базові кольори (фон / поверхні)

| Назва | HEX | Роль |
|---|---|---|
| Void Black | `#0A0E14` | Основний фон сторінки |
| Deep Slate | `#141A24` | Картки, панелі, модальні вікна |
| Panel Border | `#1E2530` | Межі карток, роздільники |

## 2. Акцентні кольори

| Назва | HEX | Роль | Пріоритет використання |
|---|---|---|---|
| Toxic Lime | `#B6FF00` | Головний акцент: CTA-кнопки, лінки, активні елементи | Високий — 1 акцент на екран |
| Neon Magenta | `#FF2E9A` | Другорядний акцент: hover-стани, бейджі, вторинні кнопки | Середній |
| Violet Signal | `#7B2FFF` | Третинний акцент: градієнти, рідкісні предмети/rare-стани | Низький |
| Blood Orange | `#FF5A1F` | Попередження / увага (timer, важливі підказки) | Дуже низький — використовувати рідко |
| Alert Red | `#FF3864` | Помилки, небезпека, втрата HP | Тільки для критичних станів |

## 3. Текст

| Назва | HEX | Роль |
|---|---|---|
| Ghost White | `#E6EAF0` | Основний текст |
| Muted Steel | `#5C6773` | Другорядний текст, disabled-стани, підписи |

---

## 4. Типографіка

| Роль | Шрифт | Використання |
|---|---|---|
| Загальний текст | `Space Mono` | Основний текст, описи, навігація, форми |
| HUD / цифри / код | `Share Tech Mono` | Таймери, коди кімнат, лічильники, технічні показники |
| Заголовки | `Audiowide` | Назва гри, великі заголовки, акцентні назви секцій |

Рекомендація: не змішувати всі три шрифти в одному маленькому UI-блоці. Для компактних елементів використовувати `Space Mono`, а `Audiowide` залишати для великих акцентів.

---

## 5. Правила застосування (UI/UX)

1. **Один головний акцент на екран.** Toxic Lime використовується лише для головної дії (primary CTA). Не дублювати кілька яскравих акцентів одночасно — це перевантажує сприйняття.
2. **Ієрархія акцентів:** Toxic Lime (дія) → Neon Magenta (другорядна дія/hover) → Violet Signal (декоративний/рідкісний статус) → Blood Orange (попередження, рідко) → Alert Red (тільки помилки).
3. **Контраст (WCAG):**
   - Ghost White (`#E6EAF0`) на Void Black (`#0A0E14`) — контраст ≈15:1 (рівень AAA), підходить для основного тексту.
   - Toxic Lime і Neon Magenta підходять для тексту кнопок/лейблів, але не для довгих текстових блоків (втома очей).
4. **Glow-ефект:** легкий `box-shadow` (10–20px, opacity 0.3–0.5) кольором акценту застосовувати лише на hover/active станах, не на статичних елементах.
5. **Попереджувальний колір (Blood Orange) — рідкісний спецпродукт.** Використовувати лише для критичних сповіщень або таймерів, не як декоративний елемент.

---

## 6. Приклад CSS-змінних

```css
:root {
  /* Backgrounds */
  --color-bg-base: #0A0E14;
  --color-bg-surface: #141A24;
  --color-border: #1E2530;

  /* Accents */
  --color-accent-primary: #B6FF00;
  --color-accent-secondary: #FF2E9A;
  --color-accent-tertiary: #7B2FFF;
  --color-warning: #FF5A1F;
  --color-danger: #FF3864;

  /* Text */
  --color-text-primary: #E6EAF0;
  --color-text-muted: #5C6773;

  /* Typography */
  --font-body: "Space Mono", monospace;
  --font-hud: "Share Tech Mono", monospace;
  --font-heading: "Audiowide", sans-serif;
}
```

---

## 7. Приклад використання (компоненти)

- **Primary Button:** background `--color-accent-primary`, text `--color-bg-base`, glow on hover.
- **Secondary Button:** transparent background, border + text `--color-accent-secondary`.
- **Warning Button:** background `--color-warning`, text `--color-bg-base` (використовувати рідко).
- **Danger Button:** transparent, border + text `--color-danger`.
- **Card:** background `--color-bg-surface`, border `--color-border`.
- **Rare item tag:** background `rgba(123,47,255,0.15)`, text lighter violet (`#B18CFF`).

---

*Документ призначений для передачі в інший AI-інструмент (напр. ChatGPT) або дизайнеру/розробнику для генерації UI-компонентів на основі цієї палітри.*
