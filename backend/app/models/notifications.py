"""Bildirishnomalar.

Bitta hodisa — bir necha qabul qiluvchi. Oʻquvchi darsga kelmasa buni
ota-onasi ham, oʻquvchining oʻzi ham koʻrishi kerak; murojaatga javob
yozilsa — narigi tomon. Shuning uchun yozuv HODISA emas, QABUL QILUVCHI
boʻyicha saqlanadi: har bir odam uchun alohida qator.

Nima uchun shunday:

  · «oʻqildi» belgisi har odamda oʻziniki. Bitta qatorda saqlansa
    ota-ona oʻqigach oʻquvchida ham oʻqilgan boʻlib qolardi;
  · kirish nazorati bir qatorga tushadi — `WHERE user_id = :men`.
    Murojaat yoki davomatning kim koʻrishi mumkinligini qayta
    hisoblash kerak emas, u yozuv yaratilayotganda hal qilingan;
  · yon menyudagi sanoq bitta `GROUP BY section` bilan chiqadi.

`section` — `core/sections.py` dagi boʻlim id si (u ayni paytda
manzilning oʻzi). Sanoq shu maydon boʻyicha guruhlanadi, shuning uchun
yangi bildirishnoma turi qoʻshilganda yon menyu oʻzgarishsiz ishlaydi.
"""

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Entity


class NotificationKind(enum.StrEnum):
    """Nima yuz berdi.

    Tur — bu SABAB, boʻlim emas. Boʻlim (`section`) qabul qiluvchining
    kabinetiga qarab hisoblanadi: bitta «kelmadi» hodisasi ota-onada
    «Davomat», oʻquvchida «Bosh sahifa» boʻlimida koʻrinadi.
    """

    ATTENDANCE_ABSENT = "attendance_absent"
    ATTENDANCE_LATE = "attendance_late"
    APPEAL_NEW = "appeal_new"
    APPEAL_MESSAGE = "appeal_message"
    APPEAL_ASSIGNED = "appeal_assigned"
    APPEAL_CLOSED = "appeal_closed"
    GRADE_NEW = "grade_new"
    HOMEWORK_NEW = "homework_new"
    HOMEWORK_GRADED = "homework_graded"
    HOMEWORK_RETURNED = "homework_returned"


#: Interfeys uchun turkum nomlari — frontend shu kodlarni oladi.
NOTIFICATION_KIND_LABELS_UZ: dict[str, str] = {
    NotificationKind.ATTENDANCE_ABSENT.value: "Darsga kelmadi",
    NotificationKind.ATTENDANCE_LATE.value: "Darsga kechikdi",
    NotificationKind.APPEAL_NEW.value: "Yangi murojaat",
    NotificationKind.APPEAL_MESSAGE.value: "Yangi xabar",
    NotificationKind.APPEAL_ASSIGNED.value: "Murojaat biriktirildi",
    NotificationKind.APPEAL_CLOSED.value: "Murojaat yopildi",
    NotificationKind.GRADE_NEW.value: "Yangi baho",
    NotificationKind.HOMEWORK_NEW.value: "Yangi uy vazifasi",
    NotificationKind.HOMEWORK_GRADED.value: "Vazifa baholandi",
    NotificationKind.HOMEWORK_RETURNED.value: "Vazifa qaytarildi",
}


class Notification(Entity):
    __tablename__ = "notifications"
    __table_args__ = (
        # Qoʻngʻiroq va yon menyu — ikkalasi ham shu indeksdan ishlaydi.
        # `read_at IS NULL` eng koʻp soʻraladigan shart.
        Index("ix_notifications_user_read", "user_id", "read_at"),
        # Roʻyxat oxirgisidan boshlab koʻrsatiladi.
        Index("ix_notifications_user_created", "user_id", "created_at"),
        # Boʻlim kesimidagi sanoq.
        Index("ix_notifications_user_section", "user_id", "section", "read_at"),
    )

    #: Kimga. Bildirishnoma har doim bitta odamniki.
    user_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    kind: Mapped[str] = mapped_column(String(32), nullable=False)

    #: Qaysi boʻlimda sanaladi — `core/sections.py` dagi id.
    section: Mapped[str] = mapped_column(String(64), nullable=False)
    #: Bosilganda qayerga oʻtiladi. Hozircha boʻlimning oʻzi; keyin
    #: aniq yozishmaga havola qilinsa faqat servis oʻzgaradi.
    link: Mapped[str] = mapped_column(String(200), nullable=False)

    title: Mapped[str] = mapped_column(String(160), nullable=False)
    body: Mapped[str] = mapped_column(String(400), nullable=False)

    #: Qaysi obyekt haqida — murojaat, davomat yozuvi. Takror
    #: bildirishnoma yubormaslik uchun ham kerak.
    object_type: Mapped[str | None] = mapped_column(String(32))
    object_id: Mapped[uuid.UUID | None] = mapped_column(PgUUID(as_uuid=True))

    #: Qaysi oʻquvchi haqida. Ota-onada bir necha farzand boʻlishi mumkin,
    #: shuning uchun bildirishnomada bola nomi koʻrsatiladi.
    student_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("students.id")
    )
    #: Kim sabab boʻldi. Oʻz amalidan bildirishnoma kelmasligi uchun
    #: servis shu maydonni tekshiradi.
    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id")
    )

    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
