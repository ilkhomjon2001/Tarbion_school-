"""TOTP — vaqtga bogʻliq bir martalik parol (RFC 6238).

**Kutubxonasiz.** Algoritm kichik va standart: HMAC-SHA1 + dinamik
kesish. `pyotp` qoʻshish uchun CLAUDE.md boʻyicha ruxsat soʻrash kerak
boʻlardi, bu esa 40 qator kod uchun ortiqcha — har bogʻliqlik oʻzi
yangi hujum yuzasi (supply chain).

Google Authenticator, Authy, 1Password, Aegis — hammasi shu standartni
qoʻllaydi, shuning uchun maxsus ilova kerak emas.

Nega SHA1: RFC 6238 ning standart varianti va barcha ilovalar aynan
shuni kutadi. Bu yerda SHA1 xesh sifatida emas, HMAC ichida
ishlatiladi — undagi maʼlum zaifliklar (kolliziya) HMAC ga taʼsir
qilmaydi.
"""

import base64
import hashlib
import hmac
import secrets
import struct
import time
from urllib.parse import quote

#: Kod uzunligi. 6 — barcha ilovalar kutadigan standart.
DIGITS = 6

#: Kod amal qiladigan oyna, soniyada.
PERIOD = 30

#: Oldingi/keyingi qadamlarga ruxsat: telefon soati bir necha soniyaga
#: chetlashishi oddiy hol. 1 qadam = ±30 soniya. Kengroq oyna kodni
#: uzoqroq amal qildiradi va oʻgʻirlangan kodning qiymatini oshiradi.
DRIFT_STEPS = 1

#: Sekret uzunligi (bayt). 20 bayt = 160 bit — RFC tavsiyasi.
SECRET_BYTES = 20


def generate_secret() -> str:
    """Yangi sekret — base32 (ilovalar shu shaklni kutadi)."""
    return base64.b32encode(secrets.token_bytes(SECRET_BYTES)).decode().rstrip("=")


def _code_at(secret: str, step: int) -> str:
    """RFC 4226 (HOTP) — TOTP shunga qadam raqami bilan quriladi."""
    # base32 dekodlash uchun uzunlik 8 ga karrali boʻlishi kerak.
    toldirilgan = secret + "=" * (-len(secret) % 8)
    kalit = base64.b32decode(toldirilgan, casefold=True)

    xabar = struct.pack(">Q", step)
    xesh = hmac.new(kalit, xabar, hashlib.sha1).digest()

    # Dinamik kesish: oxirgi baytning quyi 4 biti — boshlanish joyi.
    ofset = xesh[-1] & 0x0F
    qism = struct.unpack(">I", xesh[ofset : ofset + 4])[0] & 0x7FFFFFFF
    return str(qism % (10**DIGITS)).zfill(DIGITS)


def current_step(at: float | None = None) -> int:
    return int((at if at is not None else time.time()) // PERIOD)


def verify(secret: str, code: str, *, last_used_step: int | None = None) -> int | None:
    """Kodni tekshiradi. Toʻgʻri boʻlsa ishlatilgan QADAMNI qaytaradi.

    Qadam qaytariladi va chaqiruvchi uni saqlaydi: bir kod IKKI MARTA
    ishlatilmasligi kerak. Aks holda yelka ortidan koʻrgan yoki tarmoqni
    tinglagan odam oʻsha 30 soniya ichida oʻsha kod bilan kira olardi.

    Solishtirish `compare_digest` bilan — vaqt boʻyicha sizib chiqish
    boʻlmasin.
    """
    tozalangan = (code or "").strip().replace(" ", "")
    if not tozalangan.isdigit() or len(tozalangan) != DIGITS:
        return None

    hozirgi = current_step()
    for siljish in range(-DRIFT_STEPS, DRIFT_STEPS + 1):
        qadam = hozirgi + siljish
        if last_used_step is not None and qadam <= last_used_step:
            # Bu qadam allaqachon ishlatilgan — takroriy urinish.
            continue
        if hmac.compare_digest(_code_at(secret, qadam), tozalangan):
            return qadam
    return None


def provisioning_uri(secret: str, *, login: str, issuer: str = "Tarbion") -> str:
    """`otpauth://` havolasi — QR kodga aylantirish uchun.

    QR ni FRONTEND chizadi: rasm generatsiyasi uchun backendga
    kutubxona qoʻshish shart emas va rasm serverdan oʻtmagani maʼqul
    (u sekretni oʻzida saqlaydi).
    """
    hisob = quote(f"{issuer}:{login}", safe="")
    return (
        f"otpauth://totp/{hisob}"
        f"?secret={secret}&issuer={quote(issuer)}"
        f"&algorithm=SHA1&digits={DIGITS}&period={PERIOD}"
    )


# ─────────────────────── Tiklash kodlari ───────────────────────

#: Nechta tiklash kodi beriladi.
RECOVERY_CODE_COUNT = 8

#: Har biri necha belgidan. Chalkashadigan harflar chiqarilgan.
_ALFAVIT = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
_RECOVERY_LEN = 10


def generate_recovery_codes(count: int = RECOVERY_CODE_COUNT) -> list[str]:
    """Telefon yoʻqolganda kirish uchun bir martalik kodlar.

    2FA ni majburiy qilib, tiklash yoʻlini bermaslik — administratorni
    tizimdan butunlay chiqarib yuborish demakdir. Telefon sinadi,
    yoʻqoladi va oʻgʻirlanadi.

    Kodlar bazada XESHLANGAN holda saqlanadi: baza sizib chiqsa ular
    bilan kirib boʻlmasin.
    """
    kodlar = []
    for _ in range(count):
        xom = "".join(secrets.choice(_ALFAVIT) for _ in range(_RECOVERY_LEN))
        kodlar.append(f"{xom[:5]}-{xom[5:]}")
    return kodlar


def normalize_recovery_code(code: str) -> str:
    return (code or "").strip().upper().replace(" ", "").replace("-", "")
