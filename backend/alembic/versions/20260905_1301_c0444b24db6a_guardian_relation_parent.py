"""Qarindoshlik turi «parent» — import sukutini toʻgʻrilash.

Sxema oʻzgarmaydi: `guardians.relation` — `String(20)`, DB enum emas.
Bu FAQAT maʼlumot migratsiyasi.

Nima uchun kerak. Oʻquvchilar Excel'dan ommaviy import qilinganda
qarindoshlik soʻralmagan va hammasiga `guardian` qoʻyilgan. Interfeys
atamasi «ota-ona» ga oʻtgach (2026-09-05) bu koʻzga tashlandi:
`guardian` aynan «ota-ona EMAS» degan maʼnoni bildiradi — bobo, xola,
tayinlangan vakil. Yaʼni 98 ta oilaning har biriga notoʻgʻri
qarindoshlik yozilgan boʻlib chiqdi.

Yangi `parent` qiymati «ota yoki ona, qaysi biri koʻrsatilmagan»
degani. Import sukuti aynan shu boʻlishi kerak edi.

Nega hamma `guardian` qatori koʻchiriladi. Ishlab chiqarishda
`guardian` ni hech kim ATAYLAB tanlamagan: 100 ta yozuvdan 98 tasi
import sukuti, 2 tasi esa `father`. Yaʼni bu qiymat hozircha faqat
«toʻldirilmagan» maʼnosida ishlatilgan.

Orqaga qaytarish `parent` ni yana `guardian` qiladi — bu ham
maʼlumotni yoʻqotmaydi, chunki ikkalasi ham matn.
"""

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "c0444b24db6a"
down_revision: Union[str, Sequence[str], None] = "90019a426173"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """`guardian` → `parent`. Arxivlanganlar ham koʻchadi.

    Arxivlangani ham toʻgʻrilanadi: ketgan oʻquvchining kartochkasi
    hisobotda ochiladi va u yerda ham notoʻgʻri soʻz turmasin.
    """
    op.execute(
        sa.text("UPDATE guardians SET relation = 'parent' WHERE relation = 'guardian'")
    )


def downgrade() -> None:
    op.execute(
        sa.text("UPDATE guardians SET relation = 'guardian' WHERE relation = 'parent'")
    )
