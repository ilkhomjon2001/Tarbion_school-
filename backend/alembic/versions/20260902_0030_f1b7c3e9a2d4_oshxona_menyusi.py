"""Oshxona haftalik menyusi (OTA-08) — cafeteria_menu_items.

Revision ID: f1b7c3e9a2d4
Revises: e7a2c5d9f4b1
Create Date: 2026-09-02 00:30:00
"""

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "f1b7c3e9a2d4"
down_revision: Union[str, Sequence[str], None] = "e7a2c5d9f4b1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "cafeteria_menu_items",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("weekday", sa.Integer(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("dish", sa.String(length=120), nullable=False),
        sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index(
        "ix_cafeteria_menu_day", "cafeteria_menu_items", ["weekday", "is_archived"]
    )


def downgrade() -> None:
    op.drop_index("ix_cafeteria_menu_day", table_name="cafeteria_menu_items")
    op.drop_table("cafeteria_menu_items")
