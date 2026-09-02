"""Oʻquv rejalari (metodik baza) — curriculum_plans.

Revision ID: b5e2d8f4a7c1
Revises: 267ebe88c542
Create Date: 2026-09-02 12:00:00
"""

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision: str = "b5e2d8f4a7c1"
down_revision: Union[str, Sequence[str], None] = "267ebe88c542"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "curriculum_plans",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("fan", sa.String(length=80), nullable=False),
        sa.Column("yil", sa.String(length=10), nullable=False),
        sa.Column("sinf", sa.String(length=20), nullable=False),
        sa.Column(
            "status", sa.String(length=12), nullable=False, server_default="qoralama"
        ),
        sa.Column("source_name", sa.String(length=200), nullable=True),
        sa.Column("lessons", JSONB(), nullable=False, server_default="[]"),
        sa.Column(
            "created_by_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=True,
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
    op.create_index(
        "ix_curriculum_lookup", "curriculum_plans", ["fan", "yil", "sinf", "status"]
    )


def downgrade() -> None:
    op.drop_index("ix_curriculum_lookup", table_name="curriculum_plans")
    op.drop_table("curriculum_plans")
