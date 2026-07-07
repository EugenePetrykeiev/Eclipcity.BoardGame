# Eclipcity Product Requirements

## Purpose

This document describes the general product concept, application structure, core user flows, multiplayer model, and initial technical direction for Eclipcity.

Eclipcity is a browser-based multiplayer tabletop card game. The game is designed for desktop play first, but the website must also be adapted for tablets and mobile devices.

## Product Vision

Eclipcity is a dark cyberpunk-noir multiplayer game about escaping an oppressive city in the year 2150. Players control teams of prisoners who have escaped the system and are trying to reach the tunnel exit before the other teams.

The website should eventually combine:

1. A public-facing game website with registration, login, and a short game description.
2. A private player area where authenticated users can start or join games.
3. A multiplayer room system based on hosts and virtual rooms.
4. A real-time game table where players see the board, cards, prisoners, turn order, team colors, and visible public game state.

## Technical Direction

### Frontend

The frontend should be built with React.

React is preferred because it will make the interface easier to expand later: reusable components, state-driven UI, game table rendering, lobby screens, cards, modals, and responsive layouts.

All frontend source files should be placed in the `src/` directory.

### Backend

The backend should be built with Python and FastAPI.

FastAPI is preferred because it fits a modern API-first architecture and can support WebSockets for multiplayer updates.

The backend should support:

1. User registration and login.
2. Authentication and session handling.
3. Multiplayer rooms.
4. Lobby state.
5. Game creation and game state.
6. Turn timers.
7. Player reconnect and disconnect handling.
8. Real-time updates for all players in a room.

Real-time multiplayer updates should use WebSockets. The WebSocket connection should start when the user enters the room selection screen, so public room lists, lobby state, room joins, and game updates can be synchronized live.

### Database

The database should be PostgreSQL.

PostgreSQL should store:

1. Users and authentication data.
2. Room records.
3. Room participants.
4. Game sessions.
5. Game state snapshots.
6. Game event logs.
7. Player status, chosen color, and connection state.

## Design Direction

The visual design should use the color palette from:

`context/cyberpunk-color-palette-spec.md`

The palette concept is "Neon Wet Asphalt": dark backgrounds, controlled neon accents, readable text, and strong cyberpunk atmosphere without sacrificing usability.

The design will be specified in more detail later. For now, the main requirement is to keep the interface clear, dark, readable, and suitable for a multiplayer tabletop game.

## Authentication Flow

Players must be authenticated before starting or joining a game.

The website should include a main page with:

1. Basic description of Eclipcity.
2. Registration.
3. Login.
4. Space for future visuals and atmosphere.

Authentication should support email/password and OAuth from the beginning.

After registration or login, the player enters the authenticated game area.

## Main Game Area

After login, the player sees a game page with:

1. A button to start a new game flow.
2. A settings button.
3. User information.

The detailed visual design of this page will be described later.

## Start Game Flow

When the player clicks the start game button, a new menu opens.

The multiplayer system is based on virtual rooms. Every room has a host: the user who created it.

Rooms can be:

1. Public.
2. Private.

On the room selection page, the player can:

1. View the list of available public rooms.
2. Join an available public room.
3. Enter a room ID manually if they already have one.
4. Create a new room.

Both public and private rooms can be joined by room ID. Private rooms do not require a password.

## Room Creation

Any authenticated player can create a room.

The start game page should include a "Create Room" button.

Clicking this button opens a popup with room settings:

1. Room name.
2. Maximum number of players.
3. Public or private room type.

The maximum number of players is 5.

After room creation, the system generates a unique room ID. Other players can use this ID to join both public and private rooms.

Room IDs should be short human-readable codes with 5 to 7 mixed-case Latin letters.

## Lobby

After joining a room, the player enters the lobby.

The lobby is where players wait for the game to start.

### Host Capabilities

The host can:

1. See all players who joined the lobby.
2. Remove players from the room.
3. Start the game when at least 2 players are in the lobby, including the host.

### Non-Host Capabilities

Other players can:

1. See the list of lobby participants.
2. Leave the lobby.

### Team Colors

All players, including the host, can choose a team color in the lobby.

Available colors must not repeat between players in the same game.

If a player does not choose a color, the system assigns one automatically.

Current team colors are visual identifiers only. They help distinguish prisoners from different teams on the table.

## Game Start

When the host starts the game, the system generates the game landscape.

The landscape consists of 45 tiles in random order.

There are 9 item types. Each item appears 5 times on the board.

Tile generation rule:

1. The same tile type may appear at most 2 times in a row.
2. A repeated pair of the same tile type should occur no more than once during one board generation.

At game start, the system also:

1. Randomly determines player turn order.
2. Deals starting cards according to the game rules.
3. Places all teams at the start.
4. Initializes each player's prisoners.
5. Opens the shared game table for all players in the room.

## Game Table Layout

The game table should show all active players.

The current player's cards are always displayed at the bottom of the screen.

Suggested player placement:

1. Bottom: current player's hand.
2. Left side: maximum 1 other player.
3. Right side: maximum 1 other player.
4. Top side: up to 2 other players.

Public information must be visible to all players:

1. Player names.
2. Team colors.
3. Turn order.
4. Whose turn it is.
5. How many prisoners each player has already escaped.
6. How many cards each player has.
7. Card backs for opponents, with live card count updates.

The turn order, escaped prisoner count, and team color information should be displayed in a side panel.

## Turn Timing

Each player has no more than 2 minutes per turn.

If the timer expires, the turn automatically passes to the next player.

During the active player's turn, the bottom panel should show:

1. The player's cards.
2. Available action count, represented as energy.
3. A button to end the turn early.

A player can take up to 3 actions per turn.

If a player spends all 3 energy, the turn automatically passes to the next player.

The player may also press "End Turn" early.

Later, the turn system should include:

1. A sound signal when it becomes the player's turn.
2. A browser tab title update when it is the player's turn, so players who switched tabs can notice.

## Turn Mechanics

On their turn, the player must first choose a prisoner.

After choosing a prisoner, the player can perform one of the available actions:

1. Choose a card from their hand and play it.
2. Click an available backward tile where the prisoner can move to draw cards.

### Playing a Card

When a player plays a card with an item, the chosen prisoner automatically moves to the next free tile with the same item.

The movement should be animated.

If there are no matching free tiles ahead of the prisoner, the prisoner escapes and moves to the exit.

All other players should see this movement in real time.

When a card is played, the card should be shown in the center of the screen for the other players.

### Moving Backward

The player can choose an available backward tile according to the game rules.

This action is used to draw cards.

Available backward tiles should be visually clear after the player selects a prisoner.

## Leaving, Disconnects, and Reconnects

During a game, a player may leave manually.

If a player leaves the game intentionally, they are automatically disqualified.

If a player refreshes the page or disconnects unexpectedly, the game waits up to 2 minutes for them to return.

If the player does not return within 2 minutes, they are removed from the game and automatically disqualified.

Disqualified players' prisoners stay on the board as gray immovable objects.

The system should distinguish between:

1. Intentional leave.
2. Page refresh.
3. Temporary disconnect.
4. Reconnect within the allowed time.

If the host disconnects or leaves, the game continues and host ownership is transferred to another player.

If all players leave a room, the room is canceled after 2 minutes.

## Responsive Requirements

The website must be adapted for:

1. Desktop.
2. Tablets.
3. Mobile devices.

The game is desktop-first because of the tabletop layout, but smaller screens should still support core flows: login, registration, room creation, joining rooms, lobby, and game participation.

## Initial Page Map

1. Home page
   - Basic game description.
   - Registration.
   - Login.
   - Future visual block.

2. Authenticated game page
   - Start game button.
   - Settings button.
   - User information.

3. Room selection page
   - Public room list.
   - Join by room ID.
   - Create room button.

4. Create room popup
   - Room name.
   - Maximum player count.
   - Public/private setting.

5. Lobby page
   - Player list.
   - Team color selection.
   - Host start button.
   - Host remove player controls.
   - Leave lobby button for non-host players.

6. Game table page
   - Board with 45 item tiles.
   - Prisoners for all teams.
   - Player areas around the table.
   - Current player's cards at the bottom.
   - Public card counts.
   - Turn order and escaped prisoner status.
   - Energy/action counter.
   - End turn button.
   - Turn timer.

## Confirmed Decisions

1. The backend framework is FastAPI.
2. WebSocket real-time communication starts when the user enters the room selection screen.
3. OAuth can be supported from the beginning together with email/password authentication.
4. Private rooms are joined only by room ID and do not require a password.
5. Room IDs are 5 to 7 character mixed-case codes.
6. If the host disconnects or leaves, the game continues and host ownership transfers to another player.
7. If all players leave a room, the room is canceled after 2 minutes.
8. Disqualified players' prisoners become gray immovable objects on the board.
9. Game state should be stored using both snapshots and event logs.
10. The board uses the new 45-symbol rule: 9 item symbols, 5 copies of each.
11. User history and statistics are not part of the first version and can be added later.
