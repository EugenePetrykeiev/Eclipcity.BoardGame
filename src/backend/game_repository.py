import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.orm.attributes import flag_modified

from .game_rules import (
    ACTIONS_PER_TURN,
    PRISONERS_PER_PLAYER,
    STARTING_CARD_COUNT,
    count_escaped,
    create_initial_prisoner_positions,
    deal_initial_cards,
    find_prisoner,
    generate_route_tiles,
    nearest_forward_tile,
    nearest_occupied_backward_tile,
    normalize_draw_pile,
    normalize_game_hands,
    normalize_prisoner_positions,
    tile_occupants,
)
from .models import GameEvent, GamePlayer, GameSession, Lobby
from .schemas import UserResponse


DISCONNECT_GRACE_SECONDS = 120
HEARTBEAT_STALE_SECONDS = 20
GAME_CLOSE_DELAY_SECONDS = 60
CUSTOM_ROUTE_USERNAME = "eugenepetrikeev"


def game_path(game_id: uuid.UUID | str) -> str:
    return f"/game/{game_id}"


def allowed_route_tile_count(username: str, requested_count: int) -> int:
    if requested_count != 45 and username.casefold() != CUSTOM_ROUTE_USERNAME:
        raise PermissionError(
            "Custom route tile count is restricted to @eugenepetrikeev."
        )
    return requested_count


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


def clone_hands(game: GameSession) -> dict[str, list[str]]:
    return {
        str(player_id): list(cards)
        for player_id, cards in (game.hands or {}).items()
    }


def clone_prisoner_positions(game: GameSession) -> dict[str, list[dict]]:
    return {
        str(player_id): [dict(prisoner) for prisoner in prisoners]
        for player_id, prisoners in (game.prisoner_positions or {}).items()
    }


def mark_gameplay_state_dirty(game: GameSession) -> None:
    flag_modified(game, "hands")
    flag_modified(game, "draw_pile")
    flag_modified(game, "prisoner_positions")


def active_game_players(game: GameSession) -> list[GamePlayer]:
    return [
        player
        for player in sorted(game.players, key=lambda item: item.turn_order)
        if player.status in ("connected", "disconnected") and player.can_rejoin
    ]


def score_eligible_players(game: GameSession) -> list[GamePlayer]:
    return [
        player
        for player in game.players
        if player.finish_order is not None
        or (player.status not in ("left", "removed") and player.can_rejoin)
    ]


def current_turn_player(game: GameSession) -> GamePlayer | None:
    players = active_game_players(game)
    if not players:
        return None
    return next(
        (player for player in players if player.turn_order == game.current_turn_order),
        players[0],
    )


def advance_turn(game: GameSession) -> None:
    players = active_game_players(game)
    if not players:
        return
    current_index = next(
        (
            index
            for index, player in enumerate(players)
            if player.turn_order == game.current_turn_order
        ),
        -1,
    )
    next_player = players[(current_index + 1) % len(players)]
    game.current_turn_order = next_player.turn_order
    game.actions_taken = 0
    add_game_event(game, "turn", f"Хід перейшов до {next_player.nickname}.")


def ensure_gameplay_state(game: GameSession) -> None:
    player_ids = [str(player.user_id) for player in game.players]
    card_counts = {str(player.user_id): player.card_count for player in game.players}
    game.hands = normalize_game_hands(str(game.id), player_ids, game.hands, card_counts)
    game.draw_pile = normalize_draw_pile(str(game.id), game.hands, game.draw_pile)
    game.prisoner_positions = normalize_prisoner_positions(
        player_ids,
        game.prisoner_positions,
    )
    if not game.current_turn_order:
        players = active_game_players(game)
        game.current_turn_order = players[0].turn_order if players else 1
    if not game.actions_per_turn:
        game.actions_per_turn = ACTIONS_PER_TURN
    if game.actions_taken is None:
        game.actions_taken = 0


def sync_player_counts(game: GameSession) -> None:
    ensure_gameplay_state(game)
    for player in game.players:
        player_id = str(player.user_id)
        player.card_count = len(game.hands.get(player_id, []))
        player.escaped_prisoners = count_escaped(
            game.prisoner_positions.get(player_id, [])
        )


def assert_current_turn(game: GameSession, user: UserResponse) -> GamePlayer:
    if game.status != "active":
        raise ValueError("Game is finished.")
    player = get_game_player(game, user)
    if not player or player.status not in ("connected", "disconnected") or not player.can_rejoin:
        raise PermissionError("User is not an active participant of this game.")
    current = current_turn_player(game)
    if not current or current.user_id != user.id:
        raise PermissionError("It is not this player's turn.")
    if game.actions_taken >= game.actions_per_turn:
        raise ValueError("No actions left this turn.")
    return player


def complete_action(game: GameSession, player: GamePlayer) -> None:
    game.actions_taken += 1
    if game.actions_taken >= game.actions_per_turn:
        add_game_event(
            game,
            "turn_completed",
            f"{player.nickname} виконав {game.actions_per_turn} дії.",
        )
        advance_turn(game)


def next_finish_order(game: GameSession) -> int:
    finish_orders = [
        item.finish_order
        for item in game.players
        if item.finish_order is not None
    ]
    return (max(finish_orders) if finish_orders else 0) + 1


def maybe_finish_player(game: GameSession, player: GamePlayer) -> None:
    player_id = str(player.user_id)
    if count_escaped(game.prisoner_positions.get(player_id, [])) < player.prisoners_total:
        return

    if player.finish_order is not None:
        return

    player.finish_order = next_finish_order(game)
    player.status = "finished"
    player.can_rejoin = True
    player.disconnected_at = None
    add_game_event(
        game,
        "victory" if player.finish_order == 1 else "finished",
        f"{player.nickname} врятував усіх в'язнів і вийшов #{player.finish_order}.",
    )


def record_game_stats(game: GameSession) -> None:
    if game.stats_recorded_at is not None:
        return

    eligible_players = score_eligible_players(game)
    for player in eligible_players:
        if player.user:
            player.user.matches_played = (player.user.matches_played or 0) + 1

    winner = next(
        (
            player
            for player in eligible_players
            if player.finish_order == 1 and player.user is not None
        ),
        None,
    )
    if winner and winner.user:
        winner.user.wins = (winner.user.wins or 0) + 1

    game.stats_recorded_at = utc_now()
    add_game_event(
        game,
        "stats_recorded",
        "Статистику матчу записано.",
    )


def finalize_finish_orders(game: GameSession) -> None:
    next_order = next_finish_order(game)
    for player in sorted(score_eligible_players(game), key=lambda item: item.turn_order):
        if player.finish_order is None:
            player.finish_order = next_order
            player.status = "finished"
            next_order += 1


def close_game(game: GameSession, message: str) -> None:
    if game.status != "closed":
        game.status = "closed"
        game.ended_at = utc_now()
        finalize_finish_orders(game)
        add_game_event(game, "closed", message)
    elif game.ended_at is None:
        game.ended_at = game.stats_recorded_at or utc_now()
    record_game_stats(game)


def update_game_completion(game: GameSession) -> None:
    if game.status == "closed":
        record_game_stats(game)
        return
    if game.status != "active":
        return

    unfinished_players = active_game_players(game)
    has_finisher = any(player.finish_order is not None for player in game.players)
    if not has_finisher:
        return

    if len(unfinished_players) <= 1:
        now = utc_now()
        if game.close_scheduled_at is None:
            game.close_scheduled_at = now
            add_game_event(
                game,
                "closing_scheduled",
                "Залишився один активний гравець. Гра закриється через 1 хв.",
            )
            return

        if now >= ensure_aware(game.close_scheduled_at) + timedelta(
            seconds=GAME_CLOSE_DELAY_SECONDS
        ):
            close_game(game, "Минув таймер останнього активного гравця. Сесію закрито.")
        return

    if game.close_scheduled_at is not None:
        game.close_scheduled_at = None
        add_game_event(
            game,
            "closing_cancelled",
            "У грі знову більше одного активного гравця. Автозакриття скасовано.",
        )


def game_options():
    return (
        selectinload(GameSession.lobby),
        selectinload(GameSession.players).selectinload(GamePlayer.user),
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
            GamePlayer.status.in_(("connected", "disconnected", "finished")),
            GameSession.status == "active",
        )
        .order_by(GameSession.created_at.desc())
    )
    game = result.scalars().unique().first()
    if game:
        apply_disconnect_timeouts(game)
    return game


async def list_game_history_for_user(
    db: AsyncSession,
    user_id: uuid.UUID,
) -> list[tuple[GameSession, GamePlayer]]:
    result = await db.execute(
        select(GameSession, GamePlayer)
        .join(GamePlayer)
        .options(selectinload(GameSession.players))
        .where(
            GamePlayer.user_id == user_id,
            GamePlayer.finish_order.is_not(None),
            GameSession.status == "closed",
            GameSession.ended_at.is_not(None),
        )
        .order_by(GameSession.created_at.desc())
    )
    return list(result.unique().all())


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
    if game.status != "active":
        return

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
    update_game_completion(game)


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
    route_tile_count: int = 45,
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

    game_id = uuid.uuid4()
    game = GameSession(
        id=game_id,
        lobby_id=lobby.id,
        status="active",
        route_tiles=generate_route_tiles(tile_count=route_tile_count),
        current_turn_order=1,
        actions_taken=0,
        actions_per_turn=ACTIONS_PER_TURN,
    )
    game.lobby = lobby
    player_ids = [str(lobby_player.user_id) for lobby_player in lobby.players]
    game.hands, game.draw_pile = deal_initial_cards(str(game_id), player_ids)
    game.prisoner_positions = create_initial_prisoner_positions(player_ids)
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
                finish_order=None,
                turn_order=turn_order,
                status="connected",
                can_rejoin=True,
                last_seen_at=utc_now(),
            )
        )

    add_game_event(game, "started", f'{host.nickname} запустив гру "{lobby.name}".')
    if game.players:
        add_game_event(game, "turn", f"Перший хід: {game.players[0].nickname}.")
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
    if not game or game.status not in ("active", "closed"):
        return None

    apply_disconnect_timeouts(game)
    ensure_gameplay_state(game)
    sync_player_counts(game)
    update_game_completion(game)
    player = get_game_player(game, user)
    if not player or not player.can_rejoin or player.status in ("left", "removed"):
        raise PermissionError("User is not an active participant of this game.")

    if reconnect and game.status == "active" and player.status == "disconnected":
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
    if player and game.status == "active" and player.status != "finished":
        player.status = "connected"
        player.disconnected_at = None
        player.last_seen_at = utc_now()
    await db.flush()
    return game


async def play_card_action(
    db: AsyncSession,
    game_id: uuid.UUID,
    user: UserResponse,
    prisoner_id: str,
    card_id: str,
) -> GameSession | None:
    game = await access_game(db, game_id, user, reconnect=True)
    if not game:
        return None
    player = assert_current_turn(game, user)
    player_id = str(user.id)
    hands = clone_hands(game)
    hand = list(hands.get(player_id, []))
    if card_id not in hand:
        raise ValueError("Selected card is not in player's hand.")

    prisoner_positions = clone_prisoner_positions(game)
    prisoner = find_prisoner(prisoner_positions, player_id, prisoner_id)
    if not prisoner:
        raise ValueError("Selected prisoner does not belong to this player.")
    if prisoner.get("position") == "exit":
        raise ValueError("Escaped prisoner cannot move.")

    next_position = nearest_forward_tile(
        game.route_tiles,
        prisoner_positions,
        prisoner.get("position", "start"),
        card_id,
    )
    prisoner["position"] = next_position
    hand.remove(card_id)
    hands[player_id] = hand
    game.hands = hands
    game.prisoner_positions = prisoner_positions
    mark_gameplay_state_dirty(game)
    sync_player_counts(game)
    was_finished = player.finish_order is not None
    maybe_finish_player(game, player)
    add_game_event(
        game,
        "play_card",
        f"{player.nickname} зіграв карту {card_id} і перемістив в'язня.",
    )
    if not was_finished and player.finish_order is not None:
        game.actions_taken = 0
        advance_turn(game)
    else:
        complete_action(game, player)
    update_game_completion(game)
    await db.flush()
    return game


async def move_prisoner_back_action(
    db: AsyncSession,
    game_id: uuid.UUID,
    user: UserResponse,
    prisoner_id: str,
    target_tile_index: int,
) -> GameSession | None:
    game = await access_game(db, game_id, user, reconnect=True)
    if not game:
        return None
    player = assert_current_turn(game, user)
    player_id = str(user.id)
    hands = clone_hands(game)
    prisoner_positions = clone_prisoner_positions(game)
    prisoner = find_prisoner(prisoner_positions, player_id, prisoner_id)
    if not prisoner:
        raise ValueError("Selected prisoner does not belong to this player.")
    if not isinstance(prisoner.get("position"), int):
        raise ValueError("Only prisoners on the route can move backward.")

    current_position = int(prisoner["position"])
    nearest_tile = nearest_occupied_backward_tile(prisoner_positions, current_position)
    if target_tile_index == 0:
        has_start_prisoners = any(
            item.get("position") == "start"
            for prisoners in prisoner_positions.values()
            for item in prisoners
        )
        if nearest_tile is not None:
            raise ValueError("Prisoner can return to start only when no occupied route tile is behind.")
        if not has_start_prisoners:
            raise ValueError("Start circle is not occupied.")

        prisoner["position"] = "start"
        draw_pile = list(game.draw_pile or [])
        drawn_cards = draw_pile[:1]
        hands[player_id] = list(hands.get(player_id, [])) + drawn_cards
        game.hands = hands
        game.draw_pile = draw_pile[1:]
        game.prisoner_positions = prisoner_positions
        mark_gameplay_state_dirty(game)
        sync_player_counts(game)
        draw_message = (
            f" і добрав {len(drawn_cards)} карту."
            if drawn_cards
            else "."
        )
        add_game_event(
            game,
            "move_start",
            f"{player.nickname} повернув в'язня на старт{draw_message}",
        )
        complete_action(game, player)
        update_game_completion(game)
        await db.flush()
        return game

    if nearest_tile is None:
        raise ValueError("There is no occupied tile available behind this prisoner.")
    if target_tile_index != nearest_tile:
        raise ValueError("Prisoner can move only to the nearest occupied tile behind.")

    draw_count = len(tile_occupants(prisoner_positions, target_tile_index))
    draw_pile = list(game.draw_pile or [])
    drawn_cards = draw_pile[:draw_count]
    hands[player_id] = list(hands.get(player_id, [])) + drawn_cards
    prisoner["position"] = target_tile_index
    game.hands = hands
    game.draw_pile = draw_pile[draw_count:]
    game.prisoner_positions = prisoner_positions
    mark_gameplay_state_dirty(game)
    sync_player_counts(game)
    draw_message = (
        f" і добрав {len(drawn_cards)} карт."
        if drawn_cards
        else "."
    )
    add_game_event(
        game,
        "move_back",
        f"{player.nickname} повернув в'язня на тайл {target_tile_index}{draw_message}",
    )
    complete_action(game, player)
    update_game_completion(game)
    await db.flush()
    return game


async def end_turn_action(
    db: AsyncSession,
    game_id: uuid.UUID,
    user: UserResponse,
) -> GameSession | None:
    game = await access_game(db, game_id, user, reconnect=True)
    if not game:
        return None
    player = assert_current_turn(game, user)
    add_game_event(
        game,
        "turn_skipped",
        f"{player.nickname} завершив хід після {game.actions_taken} дій.",
    )
    advance_turn(game)
    sync_player_counts(game)
    update_game_completion(game)
    await db.flush()
    return game


async def leave_game(
    db: AsyncSession,
    game_id: uuid.UUID,
    user: UserResponse,
) -> GameSession | None:
    game = await get_game_by_id(db, game_id)
    if not game or game.status not in ("active", "closed"):
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
        close_game(game, "Усі гравці покинули гру. Сесію закрито.")
    else:
        update_game_completion(game)

    await db.flush()
    return game
