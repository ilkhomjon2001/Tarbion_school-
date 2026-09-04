"""t009 maktab bank rekvizitlari

Shartnomaning 5-bandidagi rekvizitlar (STIR, h/r, MFO, bank) bazaga
koʻchadi: ular kvitansiyada va shartnoma hujjatida chiqishi kerak.
Hammasi matn — raqamga oʻxshasa ham identifikator, bosh nol
yoʻqolmasin («00450»).

Revision ID: a56d08601550
Revises: 14f922ece868
Create Date: 2026-09-04 16:29:16.488587

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a56d08601550'
down_revision: Union[str, Sequence[str], None] = '14f922ece868'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('school_settings', sa.Column('tax_id', sa.String(length=20), server_default='', nullable=False))
    op.add_column('school_settings', sa.Column('bank_account', sa.String(length=30), server_default='', nullable=False))
    op.add_column('school_settings', sa.Column('bank_code', sa.String(length=10), server_default='', nullable=False))
    op.add_column('school_settings', sa.Column('bank_name', sa.String(length=120), server_default='', nullable=False))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('school_settings', 'bank_name')
    op.drop_column('school_settings', 'bank_code')
    op.drop_column('school_settings', 'bank_account')
    op.drop_column('school_settings', 'tax_id')
