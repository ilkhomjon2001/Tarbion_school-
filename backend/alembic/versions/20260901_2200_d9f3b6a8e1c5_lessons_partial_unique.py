"""Y4/O-jadval (audit): lessons slot unikalligi partial boʻldi.

Jadval oʻzgarganda kelajakdagi darslar arxivlanadi (Y4). Arxivlangan
dars slotni band qilib turmasligi kerak — yangi jadval boʻyicha qayta
generatsiya oʻsha slotga yangi dars yozadi. Shuning uchun unique
constraint faqat FAOL darslar ustidan amal qiladi.

Revision ID: d9f3b6a8e1c5
Revises: c4e8a1d7f6b2
Create Date: 2026-09-01 22:00:00
"""

from collections.abc import Sequence
from typing import Union

from alembic import op

revision: str = "d9f3b6a8e1c5"
down_revision: Union[str, Sequence[str], None] = "c4e8a1d7f6b2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("uq_lessons_class_id_lesson_date_period", "lessons", type_="unique")
    op.create_index(
        "uq_lessons_slot",
        "lessons",
        ["class_id", "lesson_date", "period"],
        unique=True,
        postgresql_where="NOT is_archived",
    )


def downgrade() -> None:
    op.drop_index("uq_lessons_slot", table_name="lessons")
    op.create_unique_constraint(
        "uq_lessons_class_id_lesson_date_period",
        "lessons",
        ["class_id", "lesson_date", "period"],
    )
