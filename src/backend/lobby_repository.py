import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from .models import Lobby, LobbyEvent, LobbyPlayer
from .schemas import LobbyCreateRequest, LobbyPlayerUpdateRequest, UserResponse
from .lobby_utils import create_lobby_code, lobby_path, normalize_lobby_code


def player_nickname(user: UserResponse) -> str:
    return user.username or user.email.split("@", 1)[0] or "runner"


def add_lobby_event(lobby: Lobby, event_type: str, message: str) -> None:
    lobby.events.append(LobbyEvent(event_type=event_type, message=message))


async def generate_unique_lobby_code(db: AsyncSession) -> str:
    for _ in range(40):
        code = create_lobby_code()
        result = await db.execute(select(Lobby.id).where(Lobby.code == code))
        if result.scalar_one_or_none() is None:
            return code
    raise RuntimeError("Unable to generate unique lobby code.")


def lobby_options():
    return (
        selectinload(Lobby.players),
        selectinload(Lobby.events),
    )


async def get_lobby_by_code(db: AsyncSession, code: str) -> Lobby | None:
    result = await db.execute(
        select(Lobby)
        .options(*lobby_options())
        .where(Lobby.code == normalize_lobby_code(code))
    )
    return result.scalar_one_or_none()


async def get_active_lobbies_for_user(db: AsyncSession, user_id: uuid.UUID) -> list[Lobby]:
    result = await db.execute(
        select(Lobby)
        .join(LobbyPlayer)
        .options(*lobby_options())
        .where(LobbyPlayer.user_id == user_id, Lobby.status == "waiting")
        .order_by(Lobby.created_at.asc())
    )
    return list(result.scalars().unique())


async def list_public_lobbies(db: AsyncSession) -> list[Lobby]:
    result = await db.execute(
        select(Lobby)
        .options(selectinload(Lobby.players))
        .where(Lobby.status == "waiting", Lobby.is_public.is_(True))
        .order_by(Lobby.created_at.desc())
    )
    return list(result.scalars().unique())


async def remove_user_from_lobby(
    db: AsyncSession,
    lobby: Lobby,
    user: UserResponse,
) -> Lobby:
    leaving_player = next(
        (player for player in lobby.players if player.user_id == user.id),
        None,
    )
    if not leaving_player:
        raise PermissionError("User is not in this lobby.")

    lobby.players.remove(leaving_player)
    await db.delete(leaving_player)
    add_lobby_event(lobby, "left", f"{leaving_player.nickname} покинув лоббі.")

    remaining_players = list(lobby.players)
    if not remaining_players:
        lobby.status = "closed"
        add_lobby_event(lobby, "closed", "Лоббі порожнє, тому кімнату закрито.")
        await db.flush()
        return lobby

    if leaving_player.is_host and not any(player.is_host for player in remaining_players):
        next_host = remaining_players[0]
        next_host.is_host = True
        add_lobby_event(lobby, "host_changed", f"Хост змінився на {next_host.nickname}.")

    await db.flush()
    return lobby


async def leave_other_active_lobbies(
    db: AsyncSession,
    user: UserResponse,
    keep_code: str | None = None,
) -> None:
    normalized_keep_code = normalize_lobby_code(keep_code) if keep_code else None
    active_lobbies = await get_active_lobbies_for_user(db, user.id)
    for lobby in active_lobbies:
        if normalized_keep_code and lobby.code == normalized_keep_code:
            continue
        await remove_user_from_lobby(db, lobby, user)


async def create_lobby(
    db: AsyncSession,
    user: UserResponse,
    payload: LobbyCreateRequest,
) -> Lobby:
    await leave_other_active_lobbies(db, user)

    code = await generate_unique_lobby_code(db)
    nickname = player_nickname(user)
    lobby = Lobby(
        code=code,
        name=payload.name,
        max_players=payload.max_players,
        is_public=payload.is_public,
        status="waiting",
        created_by_user_id=user.id,
    )
    lobby.players.append(
        LobbyPlayer(
            user_id=user.id,
            nickname=nickname,
            team_color="green",
            is_host=True,
        )
    )
    add_lobby_event(lobby, "created", f'{nickname} створив лоббі "{payload.name}".')
    add_lobby_event(lobby, "joined", f"{nickname} приєднався як хост.")
    db.add(lobby)
    await db.flush()
    return lobby


async def join_lobby(db: AsyncSession, code: str, user: UserResponse) -> Lobby | None:
    normalized_code = normalize_lobby_code(code)
    lobby = await get_lobby_by_code(db, code)
    if not lobby or lobby.status != "waiting":
        return None

    existing_player = next(
        (player for player in lobby.players if player.user_id == user.id),
        None,
    )
    if existing_player:
        await leave_other_active_lobbies(db, user, keep_code=normalized_code)
        return lobby

    await leave_other_active_lobbies(db, user, keep_code=normalized_code)
    lobby = await get_lobby_by_code(db, normalized_code)
    if not lobby or lobby.status != "waiting":
        return None

    if len(lobby.players) >= lobby.max_players:
        raise ValueError("Lobby is full.")

    nickname = player_nickname(user)
    lobby.players.append(
        LobbyPlayer(
            user_id=user.id,
            nickname=nickname,
            team_color="green",
            is_host=False,
        )
    )
    add_lobby_event(lobby, "joined", f"{nickname} приєднався до лоббі.")
    await db.flush()
    return lobby


async def update_lobby_player(
    db: AsyncSession,
    code: str,
    user: UserResponse,
    payload: LobbyPlayerUpdateRequest,
) -> Lobby | None:
    lobby = await get_lobby_by_code(db, code)
    if not lobby or lobby.status != "waiting":
        return None

    player = next((item for item in lobby.players if item.user_id == user.id), None)
    if not player:
        raise PermissionError("User is not in this lobby.")

    player.team_color = payload.team_color
    add_lobby_event(
        lobby,
        "team_changed",
        f"{player.nickname} обрав команду {payload.team_color}.",
    )
    await db.flush()
    return lobby


async def leave_lobby(db: AsyncSession, code: str, user: UserResponse) -> Lobby | None:
    lobby = await get_lobby_by_code(db, code)
    if not lobby or lobby.status != "waiting":
        return None
    return await remove_user_from_lobby(db, lobby, user)


async def kick_lobby_player(
    db: AsyncSession,
    code: str,
    target_user_id: uuid.UUID,
    user: UserResponse,
) -> Lobby | None:
    lobby = await get_lobby_by_code(db, code)
    if not lobby or lobby.status != "waiting":
        return None

    host = next(
        (player for player in lobby.players if player.user_id == user.id and player.is_host),
        None,
    )
    if not host:
        raise PermissionError("Only the lobby host can kick players.")

    if target_user_id == user.id:
        raise ValueError("Host cannot kick themselves.")

    target_player = next(
        (player for player in lobby.players if player.user_id == target_user_id),
        None,
    )
    if not target_player:
        raise LookupError("Player is not in this lobby.")

    lobby.players.remove(target_player)
    await db.delete(target_player)
    add_lobby_event(lobby, "kicked", f"{host.nickname} виключив {target_player.nickname}.")
    await db.flush()
    return lobby
