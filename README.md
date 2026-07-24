# Eclipcity

Eclipcity is a desktop multiplayer browser card game about escaping a noir, exhausted city in the year 2150.

## Local Frontend

The first home/auth page is implemented as a React app.

```bash
npm install
npm run dev
```

Then open the local URL printed by Vite.

## Local Full Service

Run frontend and backend together:

```bash
npm run dev:services
```

Short alias:

```bash
npm run service
```

Run the complete localhost stack with a local PostgreSQL container and migrations:

```bash
npm run dev:local
```

This starts:

1. Backend: `http://localhost:8000/docs`
2. Frontend: `http://localhost:5173/`

Stop both services with `Ctrl+C`.

## Local Docker Stack

The containerized local environment serves the frontend and API through a
dedicated Nginx service at the single origin `http://localhost`:

```bash
cp .env.docker.example .env.docker
docker compose --env-file .env.docker up --build
```

It uses separate frontend, backend, and Nginx images, an isolated local
PostgreSQL, and a one-shot Alembic migration service. See
`docs/containerization.md` for OAuth, SMTP/SES, TLS templating, AWS Secrets
Manager, and existing-database baseline instructions.

Automatic ARM64 image delivery to the separate dev EC2 hosts is described in
`cicd/README.md`. GitHub Actions uses AWS OIDC and SSM; no SSH port or long-lived
AWS access keys are required.

For a production build and home-page smoke test:

```bash
npm run build
npm run preview
npm run validate:home
```

The auth panel currently uses a client-side preview service. It validates form input, stores a temporary preview session in `localStorage`, and is ready to be replaced by FastAPI endpoints later. See `docs/auth-integration.md`.

We are building a tense tabletop-like digital experience for up to five players. Each player controls a team of fugitives: seven prisoners who were locked away for resisting the system, finally broke free, and now must cross the tunnel out of Eclipcity before the city swallows them again.

The escape is not only about running. The fugitives need equipment, courage, memory, power, navigation, money, and weapons. Those objects are scattered across the route, and every card played is a choice about who moves, who falls back, and how much risk the team can afford.

## The Game

Eclipcity takes place in a tunnel leading out of the city. The tunnel is a path of symbols, ending at the exit. At the start of the game, all participating teams begin at the tunnel entrance.

The tunnel length is 45 symbols. There are 9 item symbols, and each item appears 5 times on the route. Symbols are generated randomly along the path. The same symbol may appear at most 2 times in a row, and a repeated pair of the same symbol should occur no more than once during one route generation.

At the finish line there should be a visual representation of the tunnel exit.

## Players and Teams

The game supports a maximum of 5 players.

Each player controls one team of 7 prisoners. Each team has its own color:

1. Green
2. Purple
3. Orange
4. Pink
5. Turquoise

The first player is chosen randomly by the system.

Team colors are currently visual identifiers only. They are used to distinguish prisoners from different teams on the board.

## Cards and Items

The game uses one shared deck of 108 cards. The deck is shuffled into a random order before play begins.

Each card represents one of 9 item types:

1. Neural implant: improves intellectual abilities.
2. Screen: helps with navigation and communication.
3. Memory drive: stores important documents.
4. Power battery: keeps the electronics alive.
5. Bottle of whiskey: gives courage when the city presses in.
6. Cryptocurrency card: stores passwords, access, and funds.
7. Stun pistol: the best tool for quietly neutralizing guards.
8. Hand-drawn map: useful where there is no signal.
9. Movement-boosting shoes: help fugitives move faster.

Each item type has exactly 12 cards in the deck.

At the beginning of the game, each player receives 6 cards from the shared deck.

## Turn Structure

A turn consists of 0 to 3 actions. A player may take 0 actions voluntarily if they want to skip their turn.

There are two action types:

1. Play a card.
2. Move one of your prisoners backward to a previous occupied tile in order to draw 1 or 2 cards.

## Playing a Card

When a player plays a card, they choose one of their prisoners and move that prisoner forward to the nearest empty tile whose symbol matches the item on the card.

For example, if the player plays a stun pistol card, the chosen prisoner moves to the nearest empty stun pistol tile ahead of them.

If there is no matching empty tile ahead, the prisoner moves directly to the exit.

## Moving Backward and Drawing Cards

Cards can only be gained by moving prisoners backward.

A player may move one of their prisoners backward to the nearest occupied tile that can accept another prisoner. The player then draws cards based on how many prisoners were already standing on that tile:

1. If the tile had 1 prisoner, draw 1 card.
2. If the tile had 2 prisoners, draw 2 cards.
3. If the tile already had 3 prisoners, skip that tile and continue looking backward for the nearest tile that meets the requirement.

Prisoners on the target tile may belong to any team.

A prisoner may move backward all the way to the start tile. If a prisoner returns to the start, the player draws 1 card.

## Victory

The exit can hold any number of prisoners who manage to escape.

The game can end as soon as at least one player has moved all 7 prisoners from their team to the exit. That player is the winner.

The game may also continue after the first winner is determined, allowing the remaining players to keep playing until the last team escapes. In the standard victory condition, however, there is only one winner.

## Design Manifesto

Eclipcity should feel like a race through a city that has already decided everyone inside it is disposable.

The game is competitive, but its tension comes from scarcity and movement rather than direct combat. Players are constantly weighing forward progress against the need to retreat and gather more cards. Every step toward the exit can create an opportunity for another team. Every retreat can feel like a sacrifice, but also like preparation for the final push.

The world should be noir, cyberpunk, and depressive without becoming empty. Eclipcity is oppressive, watched, overbuilt, and tired. The fugitives are not heroes in a clean revolution. They are people with one chance, seven lives per team, and a bag of scavenged tools.

The browser version should preserve the clarity of a tabletop game: readable cards, visible routes, team colors that are easy to distinguish, and a turn flow that makes every action understandable. The atmosphere can be dark, but the interface must stay precise.

This is the first foundation. Future expansions may add more rules, events, roles, city systems, special cards, alternative tunnels, or deeper prisoner identities.

## Current Clarifications

1. The deck contains 108 cards: 12 cards for each of the 9 item types.
2. A player can skip their turn by taking 0 actions.
3. A prisoner can move backward to the start tile and draw 1 card.
4. The exit has no prisoner limit.
5. The first player to move all 7 prisoners to the exit is the winner, though the game can optionally continue for the remaining teams.
6. Team colors are currently visual only.
