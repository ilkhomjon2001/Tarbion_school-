"""telegram_id unikal (T-017, BOT-01)

Bitta Telegram akkaunt bitta odamga bogʻlanadi. Aks holda bir akkaunt
bir necha oilaning davomat va baho xabarlarini olib turardi.

Autogenerate begona jadval indekslarini ham tortdi (sherikning
migratsiyalaridagi drift) — olib tashlandi, bitta migratsiya bitta ish
qiladi.


Revision ID: e400466c242d
Revises: 6133cdc48d2c
Create Date: 2026-09-02 20:16:13.648351

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'e400466c242d'
down_revision: Union[str, Sequence[str], None] = '6133cdc48d2c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_index(op.f('ix_users_telegram_id'), table_name='users')
    op.create_index(op.f('ix_users_telegram_id'), 'users', ['telegram_id'], unique=True)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_users_telegram_id'), table_name='users')
    op.create_index(op.f('ix_users_telegram_id'), 'users', ['telegram_id'], unique=False)
