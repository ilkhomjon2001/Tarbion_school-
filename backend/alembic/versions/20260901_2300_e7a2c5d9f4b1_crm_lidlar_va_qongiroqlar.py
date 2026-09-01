"""CRM: lidlar va qoʻngʻiroqlar jurnali.

Lid — maktabga qiziqish bildirgan oila. Telefon ATAYLAB unique emas
(bir oila ikki bola uchun ikki marta murojaat qiladi), lekin qidiruv
uchun indekslangan. Shartnomalar sahifasi yangi jadval OLMAYDI —
mavjud `tuition_contracts` dan oʻqiydi.

Revision ID: e7a2c5d9f4b1
Revises: d9f3b6a8e1c5
Create Date: 2026-09-01 23:00:00
"""

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "e7a2c5d9f4b1"
down_revision: Union[str, Sequence[str], None] = "d9f3b6a8e1c5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "leads",
        sa.Column("parent_name", sa.String(length=120), nullable=False),
        sa.Column("phone", sa.String(length=20), nullable=False),
        sa.Column("child_name", sa.String(length=120), nullable=True),
        sa.Column("child_birth_year", sa.Integer(), nullable=True),
        sa.Column("source", sa.String(length=16), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("note", sa.String(length=500), nullable=True),
        sa.Column("assigned_to_id", sa.UUID(), nullable=True),
        sa.Column("student_id", sa.UUID(), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("is_archived", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["assigned_to_id"], ["users.id"], name=op.f("fk_leads_assigned_to_id_users")
        ),
        sa.ForeignKeyConstraint(
            ["student_id"], ["students.id"], name=op.f("fk_leads_student_id_students")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_leads")),
    )
    op.create_index(op.f("ix_leads_is_archived"), "leads", ["is_archived"], unique=False)
    op.create_index("ix_leads_status", "leads", ["status", "is_archived"], unique=False)
    op.create_index("ix_leads_phone", "leads", ["phone"], unique=False)

    op.create_table(
        "lead_calls",
        sa.Column("lead_id", sa.UUID(), nullable=False),
        sa.Column(
            "called_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("result", sa.String(length=24), nullable=False),
        sa.Column("note", sa.String(length=500), nullable=True),
        sa.Column("created_by_id", sa.UUID(), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("is_archived", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["lead_id"], ["leads.id"], name=op.f("fk_lead_calls_lead_id_leads")
        ),
        sa.ForeignKeyConstraint(
            ["created_by_id"],
            ["users.id"],
            name=op.f("fk_lead_calls_created_by_id_users"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_lead_calls")),
    )
    op.create_index(
        op.f("ix_lead_calls_is_archived"), "lead_calls", ["is_archived"], unique=False
    )
    op.create_index(
        "ix_lead_calls_lead", "lead_calls", ["lead_id", "called_at"], unique=False
    )
    op.create_index("ix_lead_calls_called_at", "lead_calls", ["called_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_lead_calls_called_at", table_name="lead_calls")
    op.drop_index("ix_lead_calls_lead", table_name="lead_calls")
    op.drop_index(op.f("ix_lead_calls_is_archived"), table_name="lead_calls")
    op.drop_table("lead_calls")
    op.drop_index("ix_leads_phone", table_name="leads")
    op.drop_index("ix_leads_status", table_name="leads")
    op.drop_index(op.f("ix_leads_is_archived"), table_name="leads")
    op.drop_table("leads")
