# Game Turn Flow

This document describes the first playable Eclipcity turn interface.

## Turn State

Every active game session stores:

- `route_tiles`: generated route. Standard games use 45 tiles; test games may use
  any value from 5 to 45.
- `current_turn_order`: player order that may act now.
- `actions_taken`: completed actions in the current turn.
- `actions_per_turn`: currently `3`.
- `close_scheduled_at`: starts the 1 minute auto-close countdown when only one
  unfinished player remains after at least one player has escaped.
- `stats_recorded_at`: prevents duplicate match and win statistics writes.
- `hands`: mutable cards for every player.
- `draw_pile`: shared shuffled deck remainder after initial deal.
- `prisoner_positions`: mutable prisoner positions for every player.

The frontend receives:

- `current_turn_user_id`
- `actions_taken`
- `actions_per_turn`
- `players[].hand_cards`
- `prisoners[]`

The UI displays the counter as `actions_taken/actions_per_turn`.

## Action: Play Card

Endpoint:

```http
POST /games/{game_id}/actions/play-card
```

Body:

```json
{
  "prisoner_id": "USER_UUID:p1",
  "card_id": "stun-pistol"
}
```

Rules:

- Only the current-turn player can act.
- The player must have fewer than 3 completed actions.
- The selected prisoner must belong to the current player.
- The selected card must be in the player's hand.
- The prisoner moves forward to the nearest free tile with the same `item_id`.
- A tile is free when it has no prisoners on it.
- If no matching free tile exists, the prisoner moves to `exit`.
- Prisoners on `exit` count toward `players[].escaped_prisoners`.
- The card is removed from the player's hand.
- The action counter increases by 1.
- If the counter reaches 3, the backend automatically advances the turn.

## Action: Move Back

Endpoint:

```http
POST /games/{game_id}/actions/move-back
```

Body:

```json
{
  "prisoner_id": "USER_UUID:p1",
  "target_tile_index": 12
}
```

Rules:

- Only the current-turn player can act.
- The prisoner must belong to the current player.
- The prisoner must already be on a route tile.
- The target tile must be behind the prisoner.
- The target tile must be the nearest occupied tile behind the prisoner.
- The target tile must contain 1 or 2 prisoners.
- Tiles with 3 or more prisoners are skipped.
- If the target tile has 1 prisoner before the move, the acting player draws 1 card
  from `draw_pile`.
- If the target tile has 2 prisoners before the move, the acting player draws 2 cards
  from `draw_pile`.
- Drawn cards are appended to the acting player's hand and removed from the shared
  draw pile.
- A prisoner may return to the start circle with `target_tile_index: 0` when no
  occupied route tile exists behind that prisoner and the start circle is occupied.
- Returning to the start circle draws 1 card from `draw_pile`.
- The action counter increases by 1.
- If the counter reaches 3, the backend automatically advances the turn.

## Finish, Observers, and Stats

- When all prisoners of a player reach `exit`, the player receives `finish_order`.
- The first player with `finish_order: 1` is the winner.
- Finished players can continue watching as observers; they cannot play cards or move
  prisoners.
- When only one unfinished active player remains, the backend starts a 1 minute
  close timer.
- When the timer expires, the game is closed and stats are recorded once:
  - every player who did not leave or get removed before resolution gets `+1`
    `matches_played`;
  - the first finisher gets `+1` `wins`.
- The leave-game endpoint remains available for closed sessions so players can return
  to their profile after the match is over.

## Action: End Turn

Endpoint:

```http
POST /games/{game_id}/actions/end-turn
```

Rules:

- Only the current-turn player can end their turn.
- The player may end after 0, 1, or 2 actions.
- The backend resets `actions_taken` to 0 and advances to the next active player.

## Frontend Interaction

Current implementation:

1. Select a prisoner on start or on the route.
2. Click a card in hand to play it.
3. Or click an occupied route tile to move the selected prisoner backward.
4. Use `Завершити хід` to end early.

## Test Route

The lobby host can choose the route tile count before starting a game:

- `45` keeps the standard board.
- `5` creates a short test board for quickly checking exit and victory behavior.

The backend accepts `route_tile_count` on:

```http
POST /lobbies/{lobby_code}/start-game
```

Example:

```json
{
  "route_tile_count": 5
}
```

Cards briefly animate to the center of the screen when played. Prisoner path animation
follows the tunnel route points before applying the final server state.
