"""O5 (audit): payments.receipt_no unique.

Kvitansiya raqami moliyaviy hujjat — ikki toʻlovda bir xil raqam
boʻlmasligi kerak. Avval mavjud dublikatlarga qoʻshimcha suffiks
beriladi (yozuv oʻchirilmaydi, faqat raqami aniqlashtiriladi).

Revision ID: c4e8a1d7f6b2
Revises: a7d1e4f2b9c3
Create Date: 2026-09-01 21:30:00
"""

from collections.abc import Sequence
from typing import Union

from alembic import op

revision: str = "c4e8a1d7f6b2"
down_revision: Union[str, Sequence[str], None] = "a7d1e4f2b9c3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Dublikat raqamlar: birinchisidan boshqasiga -D2, -D3 ... suffiksi.
    op.execute(
        """
        UPDATE payments p SET receipt_no = p.receipt_no || '-D' || t.rn
        FROM (
            SELECT id,
                   row_number() OVER (
                       PARTITION BY receipt_no ORDER BY created_at, id
                   ) AS rn
            FROM payments
            WHERE receipt_no IS NOT NULL
        ) t
        WHERE p.id = t.id AND t.rn > 1
        """
    )
    op.create_index(
        "uq_payments_receipt_no",
        "payments",
        ["receipt_no"],
        unique=True,
        postgresql_where="receipt_no IS NOT NULL",
    )


def downgrade() -> None:
    op.drop_index("uq_payments_receipt_no", table_name="payments")
