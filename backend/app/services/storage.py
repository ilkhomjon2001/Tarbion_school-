"""Fayl saqlash va imzolangan havola (MET-03, NFR-11, X-7).

Fayl serverning oʻz diskida yotadi, bazada faqat kalit (CLAUDE.md
10-qoida). Cloudflare R2 oʻrniga disk tanlangani — egasining qarori
(5-sentabr 2026): maʼlumot Oʻzbekistonda qoladi va mavjud zaxira
skriptiga qoʻshiladi. Almashtirish oson: `_read`/`_write` ikkitasini
S3 chaqiruviga oʻzgartirish yetadi.

Havola qanday himoyalanadi (X-7):

    Havolaning OʻZI kalit. Uni olgan har kim faylni oladi — brauzer
    `<img src>` va `<a href>` ga token qoʻsha olmaydi, shuning uchun
    yuklab olish endpointi tokensiz ishlashi kerak. Himoya HMAC imzoda:

        sig = HMAC-SHA256(jwt_secret, "<file_id>.<expires>")

    Muddat 15 daqiqa va UZAYTIRILMAYDI. Imzo `hmac.compare_digest` bilan
    tekshiriladi — bayt-bayt taqqoslash vaqt kanalini ochadi.

    Havola LOGGA YOZILMAYDI va analitikaga yuborilmaydi.

Kim faylni koʻra oladi degan savol BU YERDA hal qilinmaydi. Havola
beruvchi modul (dars kartochkasi, ariza, uy vazifasi) oldin oʻz
kirish tekshiruvini qiladi (X-1), keyin `signed_path()` ni chaqiradi.
"""

import hashlib
import hmac
import re
import unicodedata
import uuid
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import NotFoundError, ValidationError
from app.core.timeutil import local_today, utcnow
from app.models import StoredFile
from app.services.access import CurrentUser

#: MET-03 da sanab oʻtilgan turlar. Roʻyxat YOPIQ: `.svg` va `.html`
#: ataylab yoʻq — ular brauzerda skript bajaradi va saqlangan XSS beradi.
ALLOWED_EXTENSIONS: dict[str, str] = {
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".ppt": "application/vnd.ms-powerpoint",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".mp4": "video/mp4",
}

_NAME_RE = re.compile(r"[^A-Za-z0-9._ -]+")


def storage_root() -> Path:
    """Fayllar ildizi. Yoʻq boʻlsa yaratiladi."""
    root = Path(settings.file_storage_dir).resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root


def safe_name(raw: str | None) -> str:
    """Foydalanuvchi bergan nomni tozalaydi.

    Nom faqat KOʻRSATISH uchun: diskdagi yoʻl undan yasalmaydi, aks
    holda `../../etc/passwd` yoʻl chiqishiga olib kelardi. Shunga
    qaramay tozalanadi — u `Content-Disposition` sarlavhasiga tushadi.
    """
    nom = (raw or "fayl").strip()
    nom = unicodedata.normalize("NFKC", nom).replace("\\", "_").replace("/", "_")
    nom = _NAME_RE.sub("_", nom).strip("._ ") or "fayl"
    return nom[:120]


def _extension(name: str) -> str:
    kengaytma = Path(name).suffix.lower()
    if kengaytma not in ALLOWED_EXTENSIONS:
        ruxsat = ", ".join(sorted(ALLOWED_EXTENSIONS))
        raise ValidationError(f"Bu turdagi fayl qabul qilinmaydi. Ruxsat etilgan: {ruxsat}")
    return kengaytma


async def save(
    session: AsyncSession,
    user: CurrentUser,
    *,
    data: bytes,
    filename: str | None,
    content_type: str | None = None,
) -> StoredFile:
    """Faylni diskka yozadi va metamaʼlumotini bazaga qoʻyadi.

    Tur foydalanuvchi yuborgan `Content-Type` dan EMAS, kengaytmadan
    aniqlanadi: brauzer yuborgan sarlavhaga ishonib boʻlmaydi, uni
    hujumchi ixtiyoriy qilib qoʻyadi.
    """
    if not data:
        raise ValidationError("Fayl boʻsh.")
    if len(data) > settings.file_max_bytes:
        chek = settings.file_max_bytes // (1024 * 1024)
        raise ValidationError(f"Fayl {chek} MB dan oshmasin.")

    nom = safe_name(filename)
    kengaytma = _extension(nom)

    bugun = local_today()
    fayl_id = uuid.uuid4().hex
    kalit = f"{bugun.year:04d}/{bugun.month:02d}/{fayl_id}{kengaytma}"

    yol = storage_root() / kalit
    yol.parent.mkdir(parents=True, exist_ok=True)
    yol.write_bytes(data)

    yozuv = StoredFile(
        storage_key=kalit,
        original_name=nom,
        content_type=ALLOWED_EXTENSIONS.get(
            kengaytma, content_type or "application/octet-stream"
        ),
        size_bytes=len(data),
        uploaded_by_id=user.id,
    )
    session.add(yozuv)
    await session.flush()
    return yozuv


async def get(session: AsyncSession, file_id: uuid.UUID) -> StoredFile:
    fayl = await session.get(StoredFile, file_id)
    if fayl is None or fayl.is_archived:
        raise NotFoundError("Fayl topilmadi.")
    return fayl


def _signature(file_id: uuid.UUID, expires: int) -> str:
    xabar = f"{file_id}.{expires}".encode()
    return hmac.new(
        settings.jwt_secret.encode(), xabar, hashlib.sha256
    ).hexdigest()


def signed_path(file_id: uuid.UUID) -> str:
    """Imzolangan yuklab olish yoʻli — 15 daqiqa amal qiladi (X-7).

    Toʻliq URL emas, yoʻl qaytadi: domen frontendda maʼlum, backend
    esa oʻz tashqi manzilini bilishi shart emas (proksi orqasida u
    koʻpincha notoʻgʻri chiqadi).
    """
    muddat = int(utcnow().timestamp()) + settings.file_url_ttl_seconds
    imzo = _signature(file_id, muddat)
    return f"/api/v1/files/{file_id}/download?exp={muddat}&sig={imzo}"


def verify(file_id: uuid.UUID, *, expires: int, signature: str) -> None:
    """Imzo va muddatni tekshiradi. Notoʻgʻri boʻlsa `NotFoundError`.

    Ataylab «fayl topilmadi»: «imzo notoʻgʻri» deyish havolani
    tanlab koʻrishga yordam berardi.
    """
    if expires < int(utcnow().timestamp()):
        raise NotFoundError("Havola muddati tugagan. Sahifani yangilab qayta oching.")
    if not hmac.compare_digest(_signature(file_id, expires), signature):
        raise NotFoundError("Fayl topilmadi.")


def read_bytes(fayl: StoredFile) -> bytes:
    yol = storage_root() / fayl.storage_key
    if not yol.is_file():
        raise NotFoundError("Fayl topilmadi.")
    return yol.read_bytes()
