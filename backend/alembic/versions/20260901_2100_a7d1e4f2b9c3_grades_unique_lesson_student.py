"""Y7 (audit): grades — (lesson_id, student_id) partial-unique.

Parallel ikki soʻrov bitta oʻquvchiga bitta darsda ikkita baho yozib
qoʻyishi mumkin edi: oʻrtacha ikkalasini sanaydi, jurnal esa bittasini
koʻrsatadi. Indeksdan oldin mavjud dublikatlar arxivlanadi (eng yangisi
qoladi) — hech narsa oʻchirilmaydi (CLAUDE.md 1-qoida).

Faqat darsga bogʻlangan kundalik baholar qamraladi: `submission_id`
orqali kelgan uy vazifasi bahosi vazifa kesimida allaqachon unikal.

Revision ID: a7d1e4f2b9c3
Revises: 08c0dcdc3cfe
Create Date: 2026-09-01 21:00:00
"""

from collections.abc import Sequence
from typing import Union

from alembic import op

revision: str = "a7d1e4f2b9c3"
down_revision: Union[str, Sequence[str], None] = "08c0dcdc3cfe"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Dublikatlar: bir dars + bir oʻquvchi boʻyicha eng yangisidan
    # boshqa hammasi arxivlanadi.
    op.execute(
        """
        UPDATE grades SET is_archived = TRUE
        WHERE id IN (
            SELECT id FROM (
                SELECT id,
                       row_number() OVER (
                           PARTITION BY lesson_id, student_id
                           ORDER BY created_at DESC, id DESC
                       ) AS rn
                FROM grades
                WHERE NOT is_archived
                  AND submission_id IS NULL
                  AND lesson_id IS NOT NULL
            ) t
            WHERE t.rn > 1
        )
        """
    )
    op.create_index(
        "uq_grades_lesson_student",
        "grades",
        ["lesson_id", "student_id"],
        unique=True,
        postgresql_where="NOT is_archived AND submission_id IS NULL AND lesson_id IS NOT NULL",
    )


def downgrade() -> None:
    op.drop_index("uq_grades_lesson_student", table_name="grades")
