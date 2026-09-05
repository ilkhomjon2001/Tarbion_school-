"""Yuklangan fayllar (MET-03, DAV-04, UYV-01).

CLAUDE.md 10-qoida: fayl BAZADA saqlanmaydi. Bazada faqat kalit va
metamaʼlumot; baytlar diskda yotadi (`settings.file_storage_dir`).

Kim faylni koʻra oladi degan savolga bu jadval JAVOB BERMAYDI. Fayl
doim biror narsaga ilova qilinadi — dars kartochkasi, uy vazifasi,
sababli qoldirish arizasi — va kirish nazorati OʻSHA modulda boʻladi
(X-1). Bu yerda faqat "kim yukladi" va "qayerda yotibdi" turadi.
"""

import uuid

from sqlalchemy import BigInteger, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Entity


class StoredFile(Entity):
    __tablename__ = "stored_files"
    __table_args__ = (Index("ix_stored_files_owner", "uploaded_by_id", "created_at"),)

    #: Diskdagi nisbiy yoʻl — «2026/09/<uuid>.pdf». Ildiz sozlamada,
    #: shunda katalog koʻchsa bazaga tegilmaydi.
    storage_key: Mapped[str] = mapped_column(String(300), nullable=False, unique=True)

    #: Foydalanuvchi bergan nom — yuklab olishda shu qaytariladi.
    original_name: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str] = mapped_column(String(120), nullable=False)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)

    uploaded_by_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
