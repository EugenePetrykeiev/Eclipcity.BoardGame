from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy import inspect, text
from sqlalchemy.orm import DeclarativeBase

from .config import get_settings


class Base(DeclarativeBase):
    pass


settings = get_settings()
engine = create_async_engine(settings.database_url, pool_pre_ping=True)
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    expire_on_commit=False,
    class_=AsyncSession,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session


async def create_tables() -> None:
    from . import models  # noqa: F401

    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
        await ensure_user_columns(connection)
        await ensure_game_session_columns(connection)
        await ensure_game_player_columns(connection)


async def upgrade_existing_tables() -> None:
    async with engine.begin() as connection:
        await ensure_user_columns(connection)
        await ensure_game_session_columns(connection)
        await ensure_game_player_columns(connection)


async def ensure_user_columns(connection) -> None:
    def missing_columns(sync_connection) -> set[str]:
        inspector = inspect(sync_connection)
        if not inspector.has_table("users"):
            return set()
        existing = {
            column["name"]
            for column in inspector.get_columns("users")
        }
        return {
            name
            for name in {"matches_played", "wins"}
            if name not in existing
        }

    missing = await connection.run_sync(missing_columns)
    if not missing:
        return

    dialect = connection.dialect.name
    if dialect == "postgresql":
        statements = {
            "matches_played": "ALTER TABLE users ADD COLUMN IF NOT EXISTS matches_played INTEGER NOT NULL DEFAULT 0",
            "wins": "ALTER TABLE users ADD COLUMN IF NOT EXISTS wins INTEGER NOT NULL DEFAULT 0",
        }
    else:
        statements = {
            "matches_played": "ALTER TABLE users ADD COLUMN matches_played INTEGER NOT NULL DEFAULT 0",
            "wins": "ALTER TABLE users ADD COLUMN wins INTEGER NOT NULL DEFAULT 0",
        }

    for column_name, statement in statements.items():
        if column_name in missing:
            await connection.execute(text(statement))


async def ensure_game_session_columns(connection) -> None:
    def missing_columns(sync_connection) -> set[str]:
        inspector = inspect(sync_connection)
        if not inspector.has_table("game_sessions"):
            return set()
        return {
            name
            for name in {
                "hands",
                "draw_pile",
                "prisoner_positions",
                "current_turn_order",
                "actions_taken",
                "actions_per_turn",
                "close_scheduled_at",
                "stats_recorded_at",
            }
            if name not in {
                column["name"]
                for column in inspector.get_columns("game_sessions")
            }
        }

    missing = await connection.run_sync(missing_columns)
    if not missing:
        return

    dialect = connection.dialect.name
    if dialect == "postgresql":
        statements = {
            "hands": "ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS hands JSON NOT NULL DEFAULT '{}'::json",
            "draw_pile": "ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS draw_pile JSON NOT NULL DEFAULT '[]'::json",
            "prisoner_positions": "ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS prisoner_positions JSON NOT NULL DEFAULT '{}'::json",
            "current_turn_order": "ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS current_turn_order INTEGER NOT NULL DEFAULT 1",
            "actions_taken": "ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS actions_taken INTEGER NOT NULL DEFAULT 0",
            "actions_per_turn": "ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS actions_per_turn INTEGER NOT NULL DEFAULT 3",
            "close_scheduled_at": "ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS close_scheduled_at TIMESTAMP WITH TIME ZONE",
            "stats_recorded_at": "ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS stats_recorded_at TIMESTAMP WITH TIME ZONE",
        }
    else:
        statements = {
            "hands": "ALTER TABLE game_sessions ADD COLUMN hands JSON NOT NULL DEFAULT '{}'",
            "draw_pile": "ALTER TABLE game_sessions ADD COLUMN draw_pile JSON NOT NULL DEFAULT '[]'",
            "prisoner_positions": "ALTER TABLE game_sessions ADD COLUMN prisoner_positions JSON NOT NULL DEFAULT '{}'",
            "current_turn_order": "ALTER TABLE game_sessions ADD COLUMN current_turn_order INTEGER NOT NULL DEFAULT 1",
            "actions_taken": "ALTER TABLE game_sessions ADD COLUMN actions_taken INTEGER NOT NULL DEFAULT 0",
            "actions_per_turn": "ALTER TABLE game_sessions ADD COLUMN actions_per_turn INTEGER NOT NULL DEFAULT 3",
            "close_scheduled_at": "ALTER TABLE game_sessions ADD COLUMN close_scheduled_at DATETIME",
            "stats_recorded_at": "ALTER TABLE game_sessions ADD COLUMN stats_recorded_at DATETIME",
        }

    for column_name, statement in statements.items():
        if column_name in missing:
            await connection.execute(text(statement))


async def ensure_game_player_columns(connection) -> None:
    def missing_columns(sync_connection) -> set[str]:
        inspector = inspect(sync_connection)
        if not inspector.has_table("game_players"):
            return set()
        existing = {
            column["name"]
            for column in inspector.get_columns("game_players")
        }
        return {
            name
            for name in {"finish_order"}
            if name not in existing
        }

    missing = await connection.run_sync(missing_columns)
    if not missing:
        return

    dialect = connection.dialect.name
    if dialect == "postgresql":
        statements = {
            "finish_order": "ALTER TABLE game_players ADD COLUMN IF NOT EXISTS finish_order INTEGER",
        }
    else:
        statements = {
            "finish_order": "ALTER TABLE game_players ADD COLUMN finish_order INTEGER",
        }

    for column_name, statement in statements.items():
        if column_name in missing:
            await connection.execute(text(statement))
