import uuid

from fastapi import Depends, FastAPI, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from .auth_repository import (
    authenticate_password_user,
    create_password_user,
    get_user_by_email,
    get_user_by_id,
    upsert_google_user,
)
from .config import Settings, get_settings
from .database import create_tables, get_db
from .email_service import send_welcome_email
from .google_oauth import authorization_url, exchange_google_code
from .game_repository import (
    access_game,
    disconnect_deadline,
    game_path,
    get_active_game_for_user,
    heartbeat_game_player,
    leave_game,
    start_game_from_lobby,
    utc_now,
)
from .lobby_repository import (
    create_lobby,
    get_lobby_by_code,
    join_lobby,
    kick_lobby_player,
    leave_lobby,
    list_public_lobbies,
    lobby_path,
    update_lobby_player,
)
from .models import Lobby
from .schemas import (
    AuthResponse,
    ActiveGameResponse,
    GamePlayerResponse,
    GameSessionResponse,
    LobbyCreateRequest,
    LobbyPlayerUpdateRequest,
    LobbyResponse,
    LobbySummaryResponse,
    LoginRequest,
    RegisterRequest,
    UserResponse,
)
from .security import (
    create_oauth_state,
    create_session_token,
    read_oauth_state,
    read_session_token,
)


settings = get_settings()
app = FastAPI(title="Eclipcity API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


@app.on_event("startup")
async def on_startup() -> None:
    if settings.auto_create_tables:
        await create_tables()


def set_session_cookie(response: Response, user_id) -> None:
    token = create_session_token(settings, user_id)
    response.set_cookie(
        key=settings.session_cookie_name,
        value=token,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite="lax",
        max_age=settings.session_cookie_max_age,
        path="/",
    )


def user_page_path(user_id) -> str:
    return f"/user/{user_id}"


def user_page_url(user_id) -> str:
    base = str(settings.frontend_base_url).rstrip("/")
    return f"{base}{user_page_path(user_id)}"


def serialize_lobby(lobby: Lobby, user: UserResponse) -> LobbyResponse:
    players = list(lobby.players)
    is_member = any(player.user_id == user.id for player in players)
    is_host = any(player.user_id == user.id and player.is_host for player in players)
    return LobbyResponse(
        id=lobby.id,
        code=lobby.code,
        name=lobby.name,
        max_players=lobby.max_players,
        player_count=len(players),
        is_public=lobby.is_public,
        status=lobby.status,
        created_at=lobby.created_at,
        players=players,
        events=list(lobby.events),
        is_member=is_member,
        is_host=is_host,
        path=lobby_path(lobby.code),
    )


def serialize_lobby_summary(lobby: Lobby) -> LobbySummaryResponse:
    return LobbySummaryResponse(
        id=lobby.id,
        code=lobby.code,
        name=lobby.name,
        max_players=lobby.max_players,
        player_count=len(lobby.players),
        is_public=lobby.is_public,
        status=lobby.status,
        created_at=lobby.created_at,
    )


def serialize_game(game, user: UserResponse) -> GameSessionResponse:
    now = utc_now()
    players = []
    for player in game.players:
        deadline = disconnect_deadline(player)
        seconds_remaining = None
        if deadline and player.status == "disconnected":
            seconds_remaining = max(0, int((deadline - now).total_seconds()))
        players.append(
            GamePlayerResponse(
                user_id=player.user_id,
                nickname=player.nickname,
                team_color=player.team_color,
                is_host=player.is_host,
                card_count=player.card_count,
                prisoners_total=player.prisoners_total,
                escaped_prisoners=player.escaped_prisoners,
                turn_order=player.turn_order,
                status=player.status,
                can_rejoin=player.can_rejoin,
                disconnected_at=player.disconnected_at,
                disconnect_deadline=deadline,
                disconnect_seconds_remaining=seconds_remaining,
            )
        )

    current_player = next(
        (player for player in game.players if player.user_id == user.id),
        None,
    )

    return GameSessionResponse(
        id=game.id,
        lobby_code=game.lobby.code,
        lobby_name=game.lobby.name,
        status=game.status,
        path=game_path(game.id),
        route_tiles=game.route_tiles,
        players=players,
        events=list(game.events),
        current_user_id=user.id,
        is_participant=current_player is not None
        and current_player.status not in ("left", "removed")
        and current_player.can_rejoin,
        current_player_status=current_player.status if current_player else "none",
        created_at=game.created_at,
    )


async def current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    token = request.cookies.get(settings.session_cookie_name)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)

    user_id = read_session_token(settings, token)
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)

    user = await get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)

    return UserResponse.model_validate(user)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/auth/register", response_model=AuthResponse)
async def register(
    payload: RegisterRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> AuthResponse:
    if await get_user_by_email(db, payload.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email is already registered.",
        )

    try:
        user = await create_password_user(
            db,
            payload.username,
            payload.email,
            payload.password,
        )
        email_delivery_status = await send_welcome_email(db, settings, user)
        await db.commit()
    except IntegrityError as error:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username or email is already registered.",
        ) from error

    set_session_cookie(response, user.id)
    return AuthResponse(
        user=UserResponse.model_validate(user),
        next=user_page_path(user.id),
        message="Профіль створено. Ласкаво просимо до Eclipcity.",
        email_delivery_status=email_delivery_status,
    )


@app.post("/auth/login", response_model=AuthResponse)
async def login(
    payload: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> AuthResponse:
    user = await authenticate_password_user(db, payload.email, payload.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email or password is incorrect.",
        )

    set_session_cookie(response, user.id)
    return AuthResponse(
        user=UserResponse.model_validate(user),
        next=user_page_path(user.id),
        message="Вхід виконано. Сесію Eclipcity відкрито.",
    )


@app.get("/auth/me", response_model=UserResponse)
async def me(user: UserResponse = Depends(current_user)) -> UserResponse:
    return user


@app.get("/auth/session")
async def session_status(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict:
    token = request.cookies.get(settings.session_cookie_name)
    if not token:
        return {"authenticated": False, "user": None, "next": None}

    user_id = read_session_token(settings, token)
    if not user_id:
        return {"authenticated": False, "user": None, "next": None}

    user = await get_user_by_id(db, user_id)
    if not user:
        return {"authenticated": False, "user": None, "next": None}

    user_response = UserResponse.model_validate(user)
    return {
        "authenticated": True,
        "user": user_response.model_dump(mode="json"),
        "next": user_page_path(user.id),
    }


@app.get("/users/{user_id}", response_model=UserResponse)
async def user_profile(
    user_id: uuid.UUID,
    user: UserResponse = Depends(current_user),
) -> UserResponse:
    if user.id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    return user


@app.get("/lobbies/public", response_model=list[LobbySummaryResponse])
async def public_lobbies(
    user: UserResponse = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> list[LobbySummaryResponse]:
    del user
    lobbies = await list_public_lobbies(db)
    return [serialize_lobby_summary(lobby) for lobby in lobbies]


@app.post("/lobbies", response_model=LobbyResponse)
async def create_lobby_endpoint(
    payload: LobbyCreateRequest,
    user: UserResponse = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> LobbyResponse:
    lobby = await create_lobby(db, user, payload)
    await db.commit()
    return serialize_lobby(lobby, user)


@app.get("/lobbies/{lobby_code}", response_model=LobbyResponse)
async def lobby_details(
    lobby_code: str,
    user: UserResponse = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> LobbyResponse:
    lobby = await get_lobby_by_code(db, lobby_code)
    if not lobby or lobby.status != "waiting":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    return serialize_lobby(lobby, user)


@app.get("/lobby/{lobby_code}", response_model=LobbyResponse)
async def lobby_route_alias(
    lobby_code: str,
    user: UserResponse = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> LobbyResponse:
    return await lobby_details(lobby_code, user, db)


@app.post("/lobbies/{lobby_code}/join", response_model=LobbyResponse)
async def join_lobby_endpoint(
    lobby_code: str,
    user: UserResponse = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> LobbyResponse:
    try:
        lobby = await join_lobby(db, lobby_code, user)
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(error),
        ) from error

    if not lobby:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    await db.commit()
    return serialize_lobby(lobby, user)


@app.patch("/lobbies/{lobby_code}/players/me", response_model=LobbyResponse)
async def update_lobby_player_endpoint(
    lobby_code: str,
    payload: LobbyPlayerUpdateRequest,
    user: UserResponse = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> LobbyResponse:
    try:
        lobby = await update_lobby_player(db, lobby_code, user, payload)
    except PermissionError as error:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(error),
        ) from error

    if not lobby:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    await db.commit()
    return serialize_lobby(lobby, user)


@app.post("/lobbies/{lobby_code}/leave", response_model=LobbyResponse | dict[str, str])
async def leave_lobby_endpoint(
    lobby_code: str,
    user: UserResponse = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> LobbyResponse | dict[str, str]:
    try:
        lobby = await leave_lobby(db, lobby_code, user)
    except PermissionError as error:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(error),
        ) from error

    if not lobby:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    await db.commit()
    if lobby.status == "closed":
        return {"message": "Lobby closed.", "next": user_page_path(user.id)}
    return serialize_lobby(lobby, user)


@app.delete("/lobbies/{lobby_code}/players/{player_user_id}", response_model=LobbyResponse)
async def kick_lobby_player_endpoint(
    lobby_code: str,
    player_user_id: uuid.UUID,
    user: UserResponse = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> LobbyResponse:
    try:
        lobby = await kick_lobby_player(db, lobby_code, player_user_id, user)
    except PermissionError as error:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(error),
        ) from error
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        ) from error
    except LookupError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error

    if not lobby:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    await db.commit()
    return serialize_lobby(lobby, user)


@app.post("/lobbies/{lobby_code}/start-game", response_model=GameSessionResponse)
async def start_lobby_game_endpoint(
    lobby_code: str,
    user: UserResponse = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> GameSessionResponse:
    lobby = await get_lobby_by_code(db, lobby_code)
    if not lobby or lobby.status not in ("waiting", "in_game"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    try:
        game = await start_game_from_lobby(db, lobby, user)
    except PermissionError as error:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(error),
        ) from error
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(error),
        ) from error

    await db.commit()
    return serialize_game(game, user)


@app.get("/games/active", response_model=ActiveGameResponse)
async def active_game_endpoint(
    user: UserResponse = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> ActiveGameResponse:
    game = await get_active_game_for_user(db, user)
    if not game:
        return ActiveGameResponse(game=None)

    await db.commit()
    return ActiveGameResponse(game=serialize_game(game, user))


@app.get("/games/{game_id}", response_model=GameSessionResponse)
async def game_details_endpoint(
    game_id: uuid.UUID,
    user: UserResponse = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> GameSessionResponse:
    try:
        game = await access_game(db, game_id, user, reconnect=True)
    except PermissionError as error:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(error),
        ) from error

    if not game:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    await db.commit()
    return serialize_game(game, user)


@app.post("/games/{game_id}/heartbeat", response_model=GameSessionResponse)
async def game_heartbeat_endpoint(
    game_id: uuid.UUID,
    user: UserResponse = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> GameSessionResponse:
    try:
        game = await heartbeat_game_player(db, game_id, user)
    except PermissionError as error:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(error),
        ) from error

    if not game:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    await db.commit()
    return serialize_game(game, user)


@app.post("/games/{game_id}/leave", response_model=dict[str, str])
async def leave_game_endpoint(
    game_id: uuid.UUID,
    user: UserResponse = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    try:
        game = await leave_game(db, game_id, user)
    except PermissionError as error:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(error),
        ) from error

    if not game:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    await db.commit()
    return {"message": "Game left.", "next": user_page_path(user.id)}


@app.post("/auth/logout")
async def logout(response: Response) -> dict[str, str]:
    response.delete_cookie(settings.session_cookie_name, path="/")
    return {"message": "Session closed."}


@app.get("/auth/google/start")
async def google_start(request: Request, mode: str = "login") -> RedirectResponse:
    state = create_oauth_state(settings, mode if mode == "register" else "login")
    return RedirectResponse(authorization_url(request, settings, state))


@app.get("/auth/google/callback", name="google_callback")
async def google_callback(
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    db: AsyncSession = Depends(get_db),
) -> RedirectResponse:
    if error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Google OAuth failed: {error}",
        )

    if not code or not state or not read_oauth_state(settings, state):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google OAuth state is invalid.",
        )

    profile = await exchange_google_code(request, settings, code)
    user, created = await upsert_google_user(
        db,
        google_sub=profile["sub"],
        email=profile["email"],
        email_verified=profile.get("email_verified") == "true",
        name=profile.get("name"),
        picture=profile.get("picture"),
    )

    if created:
        await send_welcome_email(db, settings, user)

    await db.commit()

    redirect = RedirectResponse(user_page_url(user.id))
    set_session_cookie(redirect, user.id)
    return redirect
