"""parolni tiklash sorovlari (T-006, AUT-02)

Autogenerate uchta begona jadvalni ham tortib keldi
(cafeteria_menu_items, curriculum_plans, school_settings — sherikning
migratsiyalarida `is_archived` indeksi yoʻq). Ular ATAYLAB olib
tashlandi: bitta migratsiya bitta ish qiladi. Drift alohida tuzatiladi.


Revision ID: 6133cdc48d2c
Revises: 49dc1c52a303
Create Date: 2026-09-02 19:55:20.349804

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '6133cdc48d2c'
down_revision: Union[str, Sequence[str], None] = '49dc1c52a303'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('password_reset_requests',
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('channel', sa.String(length=16), nullable=False),
    sa.Column('code_hash', sa.String(length=255), nullable=True),
    sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('attempts', sa.Integer(), server_default='0', nullable=False),
    sa.Column('used_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('requested_ip', postgresql.INET(), nullable=True),
    sa.Column('resolved_by_id', sa.UUID(), nullable=True),
    sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('is_archived', sa.Boolean(), server_default='false', nullable=False),
    sa.Column('archived_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['resolved_by_id'], ['users.id'], name=op.f('fk_password_reset_requests_resolved_by_id_users'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_password_reset_requests_user_id_users')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_password_reset_requests'))
    )
    op.create_index(op.f('ix_password_reset_requests_is_archived'), 'password_reset_requests', ['is_archived'], unique=False)
    op.create_index('ix_reset_queue', 'password_reset_requests', ['channel', 'resolved_at', 'used_at'], unique=False)
    op.create_index('ix_reset_user_created', 'password_reset_requests', ['user_id', 'created_at'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_reset_user_created', table_name='password_reset_requests')
    op.drop_index('ix_reset_queue', table_name='password_reset_requests')
    op.drop_index(op.f('ix_password_reset_requests_is_archived'), table_name='password_reset_requests')
    op.drop_table('password_reset_requests')
