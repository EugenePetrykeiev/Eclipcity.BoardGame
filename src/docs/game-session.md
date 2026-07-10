# Game Session

Цей документ описує перший backend/frontend шар запуску гри після лоббі.

## Routes

Frontend:

- `/game/{uuid}` - сторінка ігрової сесії.

Backend:

- `POST /lobbies/{lobby_code}/start-game`
- `GET /games/active`
- `GET /games/{game_id}`
- `POST /games/{game_id}/heartbeat`
- `POST /games/{game_id}/leave`

## Start Flow

1. Хост натискає `Старт` у лоббі.
2. Frontend викликає `POST /lobbies/{lobby_code}/start-game`.
3. Backend створює `GameSession`, якщо для цього лоббі ще немає активної гри.
4. Лоббі переводиться в статус `in_game`.
5. Backend повертає `path: /game/{uuid}`.
6. Frontend переходить на сторінку гри.

Якщо game session для лоббі вже існує, endpoint повертає існуючу активну гру.

## Access Rules

У гру може зайти тільки користувач, який був учасником лоббі на момент старту.
Прямий перехід за посиланням `/game/{uuid}` для стороннього користувача поверне
`403`.

## Reconnect Rules

Кожен активний клієнт відправляє heartbeat через:

```http
POST /games/{game_id}/heartbeat
```

Якщо `last_seen_at` гравця старіший за `20` секунд, backend переводить його в
`disconnected` і ставить `disconnected_at`.

Після цього гравець має `120` секунд, щоб повернутися:

- якщо він відкриває `/game/{uuid}` або heartbeat приходить вчасно, статус
  повертається в `connected`;
- якщо `120` секунд минули, статус стає `removed`, а `can_rejoin` стає `false`;
- removed player більше не може зайти за посиланням гри.

## User Profile Reconnect

На сторінці `/user/{uuid}` frontend викликає:

```http
GET /games/active
```

Якщо backend повертає активну гру, користувач бачить popup:

> Ти вже в грі. Перепідключися до неї.

Кнопка popup веде на `/game/{uuid}`.

## Board Generation

Backend генерує `route_tiles` при старті гри:

- `45` тайлів;
- `9` типів предметів;
- кожен предмет повторюється `5` разів;
- однаковий предмет не може йти `3` рази підряд;
- повторна пара однакового предмета може трапитися не більше одного разу.

Візуальні повороти тунелю не впливають на правила гри. Frontend малює шлях як
ортогональний тунель із поворотами під `90` градусів після `2-3` прямих тайлів.

## Current Visual Layer

`GamePage` показує:

- окреслений ігровий стіл;
- тунель із 45 тайлів;
- стартовий люк;
- світлий вихід із міста;
- item-art на кожному тайлі;
- мінімізовані гуманоїдні токени команд;
- список гравців, нікнейми, кількість карт і рубашки карт;
- reconnect timer для disconnected players.
