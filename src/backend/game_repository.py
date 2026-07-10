import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from .game_rules import (
    PRISONERS_PER_PLAYER,
    STARTING_CARD_COUNT,
    generate_route_tiles,
)
from .models import GameEvent, GamePlayer, GameSession, Lobby
from .schemas import UserResponse


DISCONNECT_GRACE_SECONDS = 120
HEARTBEAT_STALE_SECONDS = 20


def game_path(game_id: uuid.UUID | str) -> str:
    return f"/game/{game_id}"


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def ensure_aware(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def disconnect_deadline(player: GamePlayer) -> datetime | None:
    if player.disconnected_at is None:
        return None
    return ensure_aware(player.disconnected_at) + timedelta(
        seconds=DISCONNECT_GRACE_SECONDS
    )


def add_game_event(game: GameSession, event_type: str, message: str) -> None:
    game.events.append(GameEvent(event_type=event_type, message=message))


def game_options():
    return (
        selectinload(GameSession.lobby),
        selectinload(GameSession.players),
        selectinload(GameSession.events),
    )


async def get_game_by_id(db: AsyncSession, game_id: uuid.UUID) -> GameSession | None:
    result = await db.execute(
        select(GameSession).options(*game_options()).where(GameSession.id == game_id)
    )
    return result.scalar_one_or_none()


async def get_active_game_for_user(
    db: AsyncSession,
    user: UserResponse,
) -> GameSession | None:
    result = await db.execute(
        select(GameSession)
        .join(GamePlayer)
        .options(*game_options())
        .where(
            GamePlayer.user_id == user.id,
            GamePlayer.can_rejoin.is_(True),
            GamePlayer.status.in_(("connected", "disconnected")),
            GameSession.status == "active",
        )
        .order_by(GameSession.created_at.desc())
    )
    game = result.scalars().unique().first()
    if game:
        apply_disconnect_timeouts(game)
    return game


async def get_active_game_for_lobby(
    db: AsyncSession,
    lobby_id: uuid.UUID,
) -> GameSession | None:
    result = await db.execute(
        select(GameSession)
        .options(*game_options())
        .where(GameSession.lobby_id == lobby_id, GameSession.status == "active")
        .order_by(GameSession.created_at.desc())
    )
    game = result.scalars().unique().first()
    if game:
        apply_disconnect_timeouts(game)
    return game


def apply_disconnect_timeouts(game: GameSession) -> None:
    now = utc_now()
    for player in game.players:
        if not player.can_rejoin or player.status in ("left", "removed"):
            continue

        if player.status == "connected":
            last_seen_at = ensure_aware(player.last_seen_at)
            if now - last_seen_at > timedelta(seconds=HEARTBEAT_STALE_SECONDS):
                player.status = "disconnected"
                player.disconnected_at = last_seen_at + timedelta(
                    seconds=HEARTBEAT_STALE_SECONDS
                )
                add_game_event(
                    game,
                    "disconnected",
                    f"{player.nickname} втратив з'єднання. Запущено таймер 2 хв.",
                )

        deadline = disconnect_deadline(player)
        if player.status == "disconnected" and deadline and now >= deadline:
            player.status = "removed"
            player.can_rejoin = False
            add_game_event(
                game,
                "removed",
                f"{player.nickname} не повернувся протягом 2 хв і вибув з гри.",
            )


def get_game_player(game: GameSession, user: UserResponse) -> GamePlayer | None:
    return next((player for player in game.players if player.user_id == user.id), None)


def reconnect_player(game: GameSession, player: GamePlayer) -> None:
    player.status = "connected"
    player.can_rejoin = True
    player.disconnected_at = None
    player.last_seen_at = utc_now()
    add_game_event(game, "reconnected", f"{player.nickname} повернувся до гри.")


async def start_game_from_lobby(
    db: AsyncSession,
    lobby: Lobby,
    user: UserResponse,
) -> GameSession:
    host = next(
        (player for player in lobby.players if player.user_id == user.id and player.is_host),
        None,
    )
    if not host:
        raise PermissionError("Only the lobby host can start the game.")

    if lobby.status not in ("waiting", "in_game"):
        raise ValueError("Lobby is not available for game start.")

    existing_game = await get_active_game_for_lobby(db, lobby.id)
    if existing_game:
        return existing_game

    game = GameSession(
        lobby_id=lobby.id,
        status="active",
        route_tiles=generate_route_tiles(),
    )
    game.lobby = lobby
    for turn_order, lobby_player in enumerate(lobby.players, start=1):
        game.players.append(
            GamePlayer(
                user_id=lobby_player.user_id,
                nickname=lobby_player.nickname,
                team_color=lobby_player.team_color,
                is_host=lobby_player.is_host,
                card_count=STARTING_CARD_COUNT,
                prisoners_total=PRISONERS_PER_PLAYER,
                escaped_prisoners=0,
                turn_order=turn_order,
                status="connected",
                can_rejoin=True,
                last_seen_at=utc_now(),
            )
        )

    add_game_event(game, "started", f'{host.nickname} запустив гру "{lobby.name}".')
    lobby.status = "in_game"
    db.add(game)
    await db.flush()
    return game


async def access_game(
    db: AsyncSession,
    game_id: uuid.UUID,
    user: UserResponse,
    reconnect: bool = False,
) -> GameSession | None:
    game = await get_game_by_id(db, game_id)
    if not game or game.status != "active":
        return None

    apply_disconnect_timeouts(game)
    player = get_game_player(game, user)
    if not player or not player.can_rejoin or player.status in ("left", "removed"):
        raise PermissionError("User is not an active participant of this game.")

    if reconnect and player.status == "disconnected":
        deadline = disconnect_deadline(player)
        if deadline and utc_now() >= deadline:
            player.status = "removed"
            player.can_rejoin = False
            raise PermissionError("Reconnect window expired.")
        reconnect_player(game, player)

    await db.flush()
    return game


async def heartbeat_game_player(
    db: AsyncSession,
    game_id: uuid.UUID,
    user: UserResponse,
) -> GameSession | None:
    game = await access_game(db, game_id, user, reconnect=True)
    if not game:
        return None

    player = get_game_player(game, user)
    if player:
        player.status = "connected"
        player.disconnected_at = None
        player.last_seen_at = utc_now()
    await db.flush()
    return game


async def leave_game(
    db: AsyncSession,
    game_id: uuid.UUID,
    user: UserResponse,
) -> GameSession | None:
    game = await get_game_by_id(db, game_id)
    if not game or game.status != "active":
        return None

    player = get_game_player(game, user)
    if not player:
        raise PermissionError("User is not an active participant of this game.")

    player.status = "left"
    player.can_rejoin = False
    player.disconnected_at = None
    player.last_seen_at = utc_now()
    add_game_event(game, "left", f"{player.nickname} покинув гру.")

    if not any(
        item.status in ("connected", "disconnected") and item.can_rejoin
        for item in game.players
    ):
        game.status = "closed"
        add_game_event(game, "closed", "Усі гравці покинули гру. Сесію закрито.")

    await db.flush()
    return game
