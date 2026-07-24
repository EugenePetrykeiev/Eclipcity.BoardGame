import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator


DEFAULT_LOBBY_NAME = "Untitled lobby"
ALLOWED_LOBBY_SYMBOLS = set(" !@#$%^&*(),./|\\?`~")
TeamColor = Literal["green", "purple", "orange", "pink", "turquoise"]


def is_lobby_name_character_allowed(character: str) -> bool:
    return character.isalnum() or character in ALLOWED_LOBBY_SYMBOLS


def normalize_lobby_name(value: str | None) -> str:
    name = (value or "").strip()
    if not name:
        return DEFAULT_LOBBY_NAME
    if len(name) < 3:
        raise ValueError("Lobby name must contain at least 3 characters.")
    if len(name) > 15:
        raise ValueError("Lobby name must contain at most 15 characters.")
    if not all(is_lobby_name_character_allowed(character) for character in name):
        raise ValueError("Lobby name contains unsupported characters.")
    return name


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=24, pattern=r"^[a-zA-Z0-9_-]+$")
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)


class UserResponse(BaseModel):
    id: uuid.UUID
    username: str
    email: EmailStr
    email_verified: bool
    avatar_url: str | None = None
    matches_played: int = 0
    wins: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


class AuthResponse(BaseModel):
    user: UserResponse
    next: str
    message: str
    email_delivery_status: str | None = None


class LobbyCreateRequest(BaseModel):
    name: str | None = Field(default=None, max_length=15, validate_default=True)
    max_players: int = Field(ge=2, le=5)
    is_public: bool = True

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str | None) -> str:
        return normalize_lobby_name(value)


class LobbyPlayerUpdateRequest(BaseModel):
    team_color: TeamColor


class LobbyPlayerResponse(BaseModel):
    user_id: uuid.UUID
    nickname: str
    team_color: TeamColor
    is_host: bool
    joined_at: datetime

    model_config = {"from_attributes": True}


class LobbyEventResponse(BaseModel):
    id: uuid.UUID
    event_type: str
    message: str
    created_at: datetime

    model_config = {"from_attributes": True}


class LobbySummaryResponse(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    max_players: int
    player_count: int
    is_public: bool
    status: str
    created_at: datetime


class LobbyResponse(LobbySummaryResponse):
    players: list[LobbyPlayerResponse]
    events: list[LobbyEventResponse]
    is_member: bool
    is_host: bool
    path: str


class GameTileResponse(BaseModel):
    index: int
    item_id: str
    shape_id: int = 0
    grid_x: int | None = None
    grid_y: int | None = None


class GamePlayerResponse(BaseModel):
    user_id: uuid.UUID
    nickname: str
    team_color: TeamColor
    is_host: bool
    card_count: int
    hand_cards: list[str] = []
    prisoners_total: int
    escaped_prisoners: int
    finish_order: int | None = None
    turn_order: int
    status: str
    can_rejoin: bool
    disconnected_at: datetime | None = None
    disconnect_deadline: datetime | None = None
    disconnect_seconds_remaining: int | None = None

    model_config = {"from_attributes": True}


class GamePrisonerResponse(BaseModel):
    id: str
    owner_user_id: uuid.UUID
    index: int
    position: int | Literal["start", "exit"]


class GameEventResponse(BaseModel):
    id: uuid.UUID
    event_type: str
    message: str
    created_at: datetime

    model_config = {"from_attributes": True}


class GameSessionResponse(BaseModel):
    id: uuid.UUID
    lobby_code: str
    lobby_name: str
    status: str
    path: str
    route_tiles: list[GameTileResponse]
    players: list[GamePlayerResponse]
    prisoners: list[GamePrisonerResponse]
    events: list[GameEventResponse]
    current_user_id: uuid.UUID
    current_turn_user_id: uuid.UUID | None = None
    actions_taken: int
    actions_per_turn: int
    is_participant: bool
    current_player_status: str
    created_at: datetime
    ended_at: datetime | None = None


class GameHistoryResponse(BaseModel):
    game_id: uuid.UUID
    started_at: datetime
    ended_at: datetime
    duration_seconds: int
    player_count: int
    finish_order: int
    team_color: TeamColor


class GameStartRequest(BaseModel):
    route_tile_count: int = Field(default=45, ge=5, le=45)


class ActiveGameResponse(BaseModel):
    game: GameSessionResponse | None = None


class GamePlayCardRequest(BaseModel):
    prisoner_id: str
    card_id: str


class GameMoveBackRequest(BaseModel):
    prisoner_id: str
    target_tile_index: int = Field(ge=0)
