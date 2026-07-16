import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from .database import Base


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("email", name="uq_users_email"),
        UniqueConstraint("username", name="uq_users_username"),
        UniqueConstraint("google_sub", name="uq_users_google_sub"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    username: Mapped[str] = mapped_column(String(24), nullable=False)
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    google_sub: Mapped[str | None] = mapped_column(String(255), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    matches_played: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    wins: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    email_deliveries: Mapped[list["EmailDelivery"]] = relationship(
        back_populates="user"
    )
    created_lobbies: Mapped[list["Lobby"]] = relationship(back_populates="created_by")
    lobby_memberships: Mapped[list["LobbyPlayer"]] = relationship(back_populates="user")


class EmailDelivery(Base):
    __tablename__ = "email_deliveries"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE")
    )
    to_email: Mapped[str] = mapped_column(String(320), nullable=False)
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    provider_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped[User] = relationship(back_populates="email_deliveries")


class Lobby(Base):
    __tablename__ = "lobbies"
    __table_args__ = (
        UniqueConstraint("code", name="uq_lobbies_code"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    code: Mapped[str] = mapped_column(String(5), nullable=False)
    name: Mapped[str] = mapped_column(String(15), nullable=False)
    max_players: Mapped[int] = mapped_column(Integer, nullable=False)
    is_public: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="waiting")
    created_by_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    created_by: Mapped[User] = relationship(back_populates="created_lobbies")
    players: Mapped[list["LobbyPlayer"]] = relationship(
        back_populates="lobby",
        cascade="all, delete-orphan",
        order_by="LobbyPlayer.joined_at",
    )
    events: Mapped[list["LobbyEvent"]] = relationship(
        back_populates="lobby",
        cascade="all, delete-orphan",
        order_by="LobbyEvent.created_at",
    )
    game_sessions: Mapped[list["GameSession"]] = relationship(back_populates="lobby")


class LobbyPlayer(Base):
    __tablename__ = "lobby_players"

    lobby_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("lobbies.id", ondelete="CASCADE"),
        primary_key=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    nickname: Mapped[str] = mapped_column(String(24), nullable=False)
    team_color: Mapped[str] = mapped_column(String(16), nullable=False, default="green")
    is_host: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    lobby: Mapped[Lobby] = relationship(back_populates="players")
    user: Mapped[User] = relationship(back_populates="lobby_memberships")


class LobbyEvent(Base):
    __tablename__ = "lobby_events"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    lobby_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("lobbies.id", ondelete="CASCADE")
    )
    event_type: Mapped[str] = mapped_column(String(32), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    lobby: Mapped[Lobby] = relationship(back_populates="events")


class GameSession(Base):
    __tablename__ = "game_sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    lobby_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("lobbies.id", ondelete="CASCADE"), unique=True
    )
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="active")
    route_tiles: Mapped[list[dict]] = mapped_column(JSON, nullable=False)
    hands: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    draw_pile: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    prisoner_positions: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    current_turn_order: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    actions_taken: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    actions_per_turn: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    close_scheduled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    stats_recorded_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    lobby: Mapped[Lobby] = relationship(back_populates="game_sessions")
    players: Mapped[list["GamePlayer"]] = relationship(
        back_populates="game",
        cascade="all, delete-orphan",
        order_by="GamePlayer.turn_order",
    )
    events: Mapped[list["GameEvent"]] = relationship(
        back_populates="game",
        cascade="all, delete-orphan",
        order_by="GameEvent.created_at",
    )


class GamePlayer(Base):
    __tablename__ = "game_players"

    game_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("game_sessions.id", ondelete="CASCADE"),
        primary_key=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    nickname: Mapped[str] = mapped_column(String(24), nullable=False)
    team_color: Mapped[str] = mapped_column(String(16), nullable=False)
    is_host: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    card_count: Mapped[int] = mapped_column(Integer, nullable=False, default=6)
    prisoners_total: Mapped[int] = mapped_column(Integer, nullable=False, default=7)
    escaped_prisoners: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    finish_order: Mapped[int | None] = mapped_column(Integer, nullable=True)
    turn_order: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="connected")
    can_rejoin: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    disconnected_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    game: Mapped[GameSession] = relationship(back_populates="players")
    user: Mapped[User] = relationship()


class GameEvent(Base):
    __tablename__ = "game_events"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    game_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("game_sessions.id", ondelete="CASCADE")
    )
    event_type: Mapped[str] = mapped_column(String(32), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    game: Mapped[GameSession] = relationship(back_populates="events")
