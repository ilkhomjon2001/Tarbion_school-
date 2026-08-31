"""Xavfsizlik middleware'lari.

Bu yerdagi har bir qatlam aniq bir hujumga qarshi turadi. Ularning
hech biri yolgʻiz yetarli emas — himoya qatlamlarda quriladi.
"""

import hashlib
import ipaddress
from collections.abc import Awaitable, Callable

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from app.core.config import settings
from app.core.ratelimit import Limit, limiter

#: Body oʻlchami chegarasi. Fayl R2 ga toʻgʻridan-toʻgʻri yuklanadi
#: (presigned URL), shuning uchun API ga katta tana kelmaydi.
MAX_BODY_BYTES = 1 * 1024 * 1024

#: `/docs` ochiq boʻlgan muhitda Swagger UI CDN dan yuklanadi, shuning
#: uchun unga CSP qoʻyilmaydi. Ishlab chiqarishda `/docs` yopiq.
_CSP_EXEMPT = ("/docs", "/redoc", "/openapi.json")


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Brauzer tomonidagi himoya sarlavhalari.

    API JSON qaytaradi va uni brauzer sahifa sifatida koʻrsatmasligi
    kerak. Sarlavhalar Caddy'da ham qoʻyilishi mumkin, lekin ilova
    ularni oʻzi qoʻyadi: proksi sozlamasi almashsa himoya yoʻqolmasin.
    """

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        response = await call_next(request)

        # MIME turini taxmin qilishni toʻsadi: JSON javobni brauzer HTML
        # deb oʻqib, undagi matnni skript sifatida bajarib yuborishi
        # mumkin edi (XSS orqali content sniffing).
        response.headers["X-Content-Type-Options"] = "nosniff"
        # Clickjacking: API javobini iframe ichiga solib boʻlmasin.
        response.headers["X-Frame-Options"] = "DENY"
        # Havola bilan birga toʻliq URL (va undagi id lar) begona saytga
        # ketmasin.
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        # Bizga kamera, mikrofon va joylashuv kerak emas.
        response.headers["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
        )
        response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
        response.headers["Cross-Origin-Resource-Policy"] = "same-site"

        # `Server: uvicorn` versiyani oshkor qiladi. Bu oʻzi zaiflik
        # emas, lekin hujumchiga "qaysi CVE ni sinab koʻray" degan
        # savolga tayyor javob beradi. Skanerlar aynan shunga qaraydi.
        response.headers["Server"] = "tarbion"

        if request.url.path not in _CSP_EXEMPT:
            # API uchun eng qatʼiy CSP: hech narsa yuklanmaydi. Javob
            # JSON, unda skript ham, rasm ham yoʻq.
            response.headers["Content-Security-Policy"] = (
                "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
            )

        if settings.is_production:
            # HSTS: brauzer bir marta HTTPS bilan kirgach, keyin hech
            # qachon HTTP ga tushmaydi (SSL stripping'ga qarshi).
            response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"

        return response


class BodySizeLimitMiddleware(BaseHTTPMiddleware):
    """Juda katta soʻrov tanasini PARSE QILISHDAN OLDIN rad etadi.

    Pydantic 100 MB lik JSON ni ham oʻqishga urinadi va shu paytgacha
    xotira band boʻladi. Bitta soʻrov bilan serverni yiqitish — eng
    arzon DoS.
    """

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        uzunlik = request.headers.get("content-length")
        if uzunlik is not None:
            try:
                if int(uzunlik) > MAX_BODY_BYTES:
                    return JSONResponse(
                        status_code=413,
                        content={
                            "code": "juda_katta",
                            "message": "Yuborilgan maʼlumot juda katta.",
                        },
                    )
            except ValueError:
                return JSONResponse(
                    status_code=400,
                    content={"code": "notogri_sorov", "message": "Soʻrov buzilgan."},
                )
        return await call_next(request)


class RealClientIPMiddleware:
    """`X-Forwarded-For` dan haqiqiy IP ni oladi — FAQAT ishonchli proksidan.

    Bu ikki tomonlama muhim:

    · Proksi ortida `request.client.host` har doim `127.0.0.1` boʻladi.
      Shunda IP boʻyicha bloklash butun dunyoni bitta "foydalanuvchi"
      deb hisoblaydi va audit yozuvlaridagi IP ham foydasiz boʻladi.

    · Sarlavhaga koʻr-koʻrona ishonib boʻlmaydi: uni HAR KIM yuborishi
      mumkin. Ishonchli boʻlmagan manbadan kelgan `X-Forwarded-For`
      bloklashni butunlay aylanib oʻtish vositasiga aylanardi — hujumchi
      har soʻrovda yangi IP yozib qoʻyaverardi.

    Shu sababli sarlavha faqat `trusted_proxies` roʻyxatidagi manzildan
    kelgan boʻlsa oʻqiladi.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app
        self._trusted = _parse_networks(settings.trusted_proxies)

    async def __call__(self, scope: dict, receive: object, send: object) -> None:  # type: ignore[override]
        if scope["type"] == "http" and self._trusted and scope.get("client"):
            peer = scope["client"][0]
            if _in_networks(peer, self._trusted):
                haqiqiy = _first_forwarded(dict(scope.get("headers") or []))
                if haqiqiy is not None:
                    scope["client"] = (haqiqiy, scope["client"][1])
        await self.app(scope, receive, send)  # type: ignore[arg-type]


def _parse_networks(values: list[str]) -> list[ipaddress.IPv4Network | ipaddress.IPv6Network]:
    tarmoqlar = []
    for v in values:
        try:
            tarmoqlar.append(ipaddress.ip_network(v, strict=False))
        except ValueError:
            continue
    return tarmoqlar


def _in_networks(ip: str, networks: list[ipaddress.IPv4Network | ipaddress.IPv6Network]) -> bool:
    try:
        manzil = ipaddress.ip_address(ip)
    except ValueError:
        return False
    return any(manzil in n for n in networks)


def _first_forwarded(headers: dict[bytes, bytes]) -> str | None:
    """`X-Forwarded-For` dagi BIRINCHI manzil — asl mijoz.

    Zanjir `mijoz, proksi1, proksi2` koʻrinishida boʻladi. Oxirgisini
    olish eng yaqin proksini beradi, bizga esa asl mijoz kerak.
    """
    xom = headers.get(b"x-forwarded-for")
    if not xom:
        return None
    birinchi = xom.decode("latin-1").split(",")[0].strip()
    try:
        ipaddress.ip_address(birinchi)
    except ValueError:
        return None
    return birinchi


# ─────────────────────────── Rate limiting ───────────────────────────

#: Yozish amallari — oʻqishdan qatʼiy. Bitta odam daqiqada 60 marta
#: baho qoʻymaydi; bunday tezlik yo skript, yo xato sikl demakdir.
_YOZISH = Limit(requests=60, window=60)

#: Umumiy chegara. Jurnal ekrani bitta ochilishda ~5 soʻrov yuboradi,
#: shuning uchun keng qoʻyilgan: chegara ODDIY ishni toʻsmasligi kerak,
#: aks holda uni oʻchirib qoʻyishadi va himoya butunlay yoʻqoladi.
_UMUMIY = Limit(requests=300, window=60)

#: Sezgir endpointlar — parol tiklash, hisob ochish, eksport. Ular
#: sekin va qimmat; ularni ketma-ket chaqirish normal ish emas.
_SEZGIR: dict[str, Limit] = {
    # 20 — odam daqiqada bir necha marta kiradi, skript esa
    # oʻnlab marta. Baza tomonidagi bloklash (login_attempts) undan
    # qatʼiyroq va uzoq muddatli; bu esa arzon birinchi toʻsiq.
    "/api/v1/auth/login": Limit(requests=20, window=60),
    "/api/v1/auth/refresh": Limit(requests=30, window=60),
    "/api/v1/auth/change-password": Limit(requests=5, window=300),
}

#: Yoʻl boʻlagi bilan boshlanadigan sezgir amallar (id oʻzgaruvchi
#: boʻlgani uchun aniq moslik ishlamaydi).
_SEZGIR_PREFIKS: tuple[tuple[str, Limit], ...] = (
    ("/api/v1/school/staff", Limit(requests=20, window=60)),
    ("/api/v1/access/", Limit(requests=30, window=60)),
)

_CHEKLANMAYDI = ("/health", "/health/ready", "/docs", "/openapi.json")


def _limit_for(path: str, method: str) -> Limit:
    aniq = _SEZGIR.get(path)
    if aniq is not None:
        return aniq
    if method != "GET":
        for prefiks, limit in _SEZGIR_PREFIKS:
            if path.startswith(prefiks):
                return limit
        return _YOZISH
    return _UMUMIY


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Soʻrovlar chastotasini cheklaydi.

    Kalit — foydalanuvchi tokeni boʻlsa oʻsha, boʻlmasa IP. Nega token
    afzal: bitta maktab bitta NAT ortidan chiqadi va faqat IP boʻyicha
    cheklash butun maktabni bitta foydalanuvchi deb hisoblardi.

    Token XESHLANADI: kalit xotirada qoladi va logga tushishi mumkin,
    tokenning oʻzi esa hech qayerda saqlanmasligi kerak (X-10).
    """

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        yol = request.url.path
        if yol in _CHEKLANMAYDI:
            return await call_next(request)

        limit = _limit_for(yol, request.method)
        kalit = f"{_identity(request)}:{yol if yol in _SEZGIR else request.method}"

        ruxsat, kutish = limiter.check(kalit, limit)
        if not ruxsat:
            return JSONResponse(
                status_code=429,
                content={
                    "code": "juda_kop_sorov",
                    "message": "Juda koʻp soʻrov yuborildi. Birozdan soʻng qayta urinib koʻring.",
                },
                headers={"Retry-After": str(kutish)},
            )

        return await call_next(request)


def _identity(request: Request) -> str:
    """Kim soʻrayapti: token egasi yoki IP."""
    auth = request.headers.get("Authorization", "")
    if auth.lower().startswith("bearer "):
        token = auth[7:]
        # Token oʻzi kalit boʻlmasin — xeshi yetarli va u logga
        # tushsa ham zarar yoʻq.
        return "t:" + hashlib.sha256(token.encode()).hexdigest()[:32]
    return "ip:" + (request.client.host if request.client else "nomalum")
