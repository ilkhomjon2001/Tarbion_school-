"""Audit jurnali sxemalari (T-021).

Kirish sxemasi YOʻQ — bu jurnal faqat oʻqiladi. Yozuv servislardan
avtomatik tushadi va uni tashqaridan yaratib boʻlmaydi.
"""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel


class AuditEntryOut(BaseModel):
    id: uuid.UUID
    created_at: datetime
    object_type: str
    object_id: uuid.UUID | None
    action: str
    #: Faqat OʻZGARGAN maydonlar — butun obyekt emas.
    old_value: dict[str, Any] | None
    new_value: dict[str, Any] | None
    actor_id: uuid.UUID | None
    #: `null` — tizim qilgan (masalan darslar generatsiyasi).
    actor_name: str | None
    ip_address: str | None


class AuditPageOut(BaseModel):
    rows: list[AuditEntryOut]
    total: int
    has_more: bool


class AuditFiltersOut(BaseModel):
    """Jurnalda haqiqatan uchraydigan qiymatlar.

    Qatʼiy roʻyxat emas: yangi modul qoʻshilganda filtr oʻzi
    kengayadi.
    """

    object_types: list[str]
    actions: list[str]
