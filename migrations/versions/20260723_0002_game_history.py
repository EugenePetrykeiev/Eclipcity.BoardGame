"""Add game completion timestamp for match history.

Revision ID: 20260723_0002
Revises: 20260717_0001
Create Date: 2026-07-23
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260723_0002"
down_revision: Union[str, None] = "20260717_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "game_sessions",
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.execute(
        """
        UPDATE game_sessions
        SET ended_at = COALESCE(stats_recorded_at, updated_at)
        WHERE status = 'closed' AND ended_at IS NULL
        """
    )


def downgrade() -> None:
    op.drop_column("game_sessions", "ended_at")
