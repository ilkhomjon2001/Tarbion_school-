"""Maktab rekvizitlari (school_settings) — sozlamalar va kvitansiya uchun.

Revision ID: a3c9e5f7b1d8
Revises: f1b7c3e9a2d4
Create Date: 2026-09-02 01:00:00
"""

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "a3c9e5f7b1d8"
down_revision: Union[str, Sequence[str], None] = "f1b7c3e9a2d4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "school_settings",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("address", sa.String(length=200), nullable=False, server_default=""),
        sa.Column("phone", sa.String(length=40), nullable=False, server_default=""),
        sa.Column(
            "director_name", sa.String(length=120), nullable=False, server_default=""
        ),
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


def downgrade() -> None:
    op.drop_table("school_settings")
