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

from sqlalchemy import DateTime, ForeignKey, Index, String, UniqueConstraint, func
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
    ANNOUNCEMENT = "announcement"


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
    NotificationKind.ANNOUNCEMENT.value: "Eʼlon",
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


class OutboxStatus(enum.StrEnum):
    """Tashqi xabarning holati.

    `CANCELLED` — yuborilishidan oldin sabab yoʻqoldi. Masalan ustoz
    davomatni «kelmadi» dan «keldi» ga tuzatdi: xabar hali navbatda
    turgan boʻlsa uni yuborish notoʻgʻri boʻlardi.
    """

    PENDING = "pending"
    SENT = "sent"
    FAILED = "failed"
    CANCELLED = "cancelled"


class OutboxChannel(enum.StrEnum):
    """Qayerga yuboriladi (BOT-02).

    Tizim ichidagi bildirishnoma bu yerda YOʻQ — u `Notification`
    jadvalida, darhol yoziladi va yuborishni talab qilmaydi.
    """

    TELEGRAM = "telegram"


class NotificationOutbox(Entity):
    """Tashqariga yuboriladigan xabarlar navbati (T-018, BOT-02, BOT-06).

    Kod xabarni TOʻGʻRIDAN-TOʻGʻRI yubormaydi — shu jadvalga yozadi.
    Sabab: Telegram soʻrovi sekin va ishonchsiz. Davomat saqlash
    tranzaksiyasi ichida yuborilsa, Telegram javob bermaganda butun
    davomat yiqilardi. Bu yerda esa xabar yozilib qoladi va alohida
    worker uni keyinroq yetkazadi.

    Qayta urinish `send_after` orqali: xato boʻlsa vaqt oldinga suriladi
    (backoff), uch urinishdan keyin `failed`. Yetkazilmagan xabar
    yoʻqolmaydi — administrator uni koʻradi va qayta yuborishi mumkin
    (BOT-06).
    """

    __tablename__ = "notification_outbox"
    __table_args__ = (
        # Worker'ning asosiy soʻrovi: navbatdagi, vaqti kelgan xabarlar.
        Index("ix_outbox_navbat", "status", "send_after"),
        # Administrator ekrani va BOT-07 (kunlik jamlash) uchun.
        Index("ix_outbox_user_kind", "user_id", "kind", "created_at"),
        # Sabab yoʻqolganda bekor qilish uchun.
        Index("ix_outbox_object", "object_type", "object_id", "status"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    kind: Mapped[str] = mapped_column(String(40), nullable=False)
    channel: Mapped[str] = mapped_column(
        String(16), nullable=False, server_default=OutboxChannel.TELEGRAM.value
    )

    title: Mapped[str] = mapped_column(String(160), nullable=False)
    body: Mapped[str] = mapped_column(String(1000), nullable=False)

    status: Mapped[str] = mapped_column(
        String(12),
        nullable=False,
        default=OutboxStatus.PENDING.value,
        server_default=OutboxStatus.PENDING.value,
        index=True,
    )
    #: Shu vaqtdan oldin yuborilmaydi. Kechiktirilgan xabar (kunlik
    #: xulosa) va backoff uchun bitta maydon yetadi.
    send_after: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    attempts: Mapped[int] = mapped_column(nullable=False, default=0, server_default="0")
    last_error: Mapped[str | None] = mapped_column(String(300))
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    #: Sabab boʻlgan obyekt — davomat yozuvi, eʼlon. Sabab oʻzgarsa
    #: navbatdagi xabar shu boʻyicha topib bekor qilinadi.
    object_type: Mapped[str | None] = mapped_column(String(32))
    object_id: Mapped[uuid.UUID | None] = mapped_column(PgUUID(as_uuid=True))


class NotificationPreference(Entity):
    """Foydalanuvchi qaysi turdagi xabarni oladi (T-018).

    Yozuv faqat OʻCHIRILGAN turlar uchun yaratiladi: sukut boʻyicha
    hamma tur yoqiq. Shunda yangi tur qoʻshilganda hech kimga qator
    yozish kerak emas.

    Ilova B da bir necha tur «majburiy» deb belgilangan (masalan tizimga
    kirish maʼlumotlari) — ularni oʻchirib boʻlmaydi, buni servis
    tekshiradi.
    """

    __tablename__ = "notification_preferences"
    __table_args__ = (UniqueConstraint("user_id", "kind"),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    kind: Mapped[str] = mapped_column(String(40), nullable=False)
    enabled: Mapped[bool] = mapped_column(nullable=False, default=True, server_default="true")


class MessageTemplate(Entity):
    """Xabar matni shabloni (BOT-05, T-019).

    Matnlar KODDA emas, shu jadvalda — administrator ularni tahrirlay
    oladi. Lekin jadval faqat OʻZGARTIRILGAN shablonlarni saqlaydi:
    sukut boʻyicha matn `services/template_service.py` da. Shunda yangi
    xabar turi qoʻshilganda bazaga qator yozish shart emas va boʻsh
    bazada ham tizim toʻliq ishlaydi.

    Oʻrin egallovchi maydonlar jingalak qavsda: `{student_name}`,
    `{date}`, `{subject}`. Nomaʼlum maydon matnda qolib ketadi va
    yuborilmaydi — servis buni saqlashdan oldin tekshiradi.
    """

    __tablename__ = "message_templates"
    __table_args__ = (UniqueConstraint("kind"),)

    kind: Mapped[str] = mapped_column(String(40), nullable=False)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    body: Mapped[str] = mapped_column(String(1000), nullable=False)
    updated_by_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
