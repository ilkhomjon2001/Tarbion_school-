"""Domen xatolari va global handler.

CLAUDE.md: xatolar shu yerdagi klasslar orqali → global handler.
NFR-15: foydalanuvchiga tushunarli xabar va keyingi qadam ko'rsatiladi,
shuning uchun har xatoning o'zbekcha matni bor.
"""

from fastapi import Request, status
from fastapi.responses import JSONResponse


class AppError(Exception):
    """Barcha domen xatolarining asosi."""

    status_code: int = status.HTTP_400_BAD_REQUEST
    code: str = "xato"
    message: str = "Soʻrovni bajarib boʻlmadi."

    def __init__(self, message: str | None = None, **details: object) -> None:
        self.message = message or self.message
        self.details = details
        super().__init__(self.message)


class NotFoundError(AppError):
    status_code = status.HTTP_404_NOT_FOUND
    code = "topilmadi"
    message = "Soʻralgan maʼlumot topilmadi."


class InvalidCredentialsError(AppError):
    status_code = status.HTTP_401_UNAUTHORIZED
    code = "notogri_malumot"
    message = "Telefon raqami yoki parol notoʻgʻri."


class AuthRequiredError(AppError):
    status_code = status.HTTP_401_UNAUTHORIZED
    code = "kirish_kerak"
    message = "Sessiya muddati tugagan. Qaytadan kiring."


class AccountLockedError(AppError):
    """AUT-05: 5 marta noto'g'ri parol → 15 daqiqa blok."""

    status_code = status.HTTP_423_LOCKED
    code = "hisob_bloklandi"
    message = "Hisob vaqtincha bloklandi. Birozdan soʻng qayta urinib koʻring."


class AccountInactiveError(AppError):
    """AUT-07: administrator foydalanuvchini faolsizlantirgan."""

    status_code = status.HTTP_403_FORBIDDEN
    code = "hisob_faol_emas"
    message = "Hisobingiz faol emas. Maktab administratoriga murojaat qiling."


class PermissionDeniedError(AppError):
    """NFR-08 va 6-domen qoidasi."""

    status_code = status.HTTP_403_FORBIDDEN
    code = "ruxsat_yoq"
    message = "Bu amal uchun ruxsatingiz yoʻq."


class EditWindowClosedError(AppError):
    """DAV-03: dars tugaganidan 24 soat oʻtgach ustoz tahrirlay olmaydi."""

    status_code = status.HTTP_403_FORBIDDEN
    code = "muddat_tugadi"
    message = "Bu darsni tahrirlash muddati tugagan. Administratorga murojaat qiling."


class ConflictError(AppError):
    """ADM-09: jadval toʻqnashuvi va shunga oʻxshash holatlar."""

    status_code = status.HTTP_409_CONFLICT
    code = "toqnashuv"
    message = "Bu amal mavjud maʼlumot bilan toʻqnashadi."


class ValidationError(AppError):
    status_code = status.HTTP_422_UNPROCESSABLE_CONTENT
    code = "notogri_qiymat"
    message = "Kiritilgan maʼlumot notoʻgʻri."


async def app_error_handler(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, AppError)
    body: dict[str, object] = {"code": exc.code, "message": exc.message}
    if exc.details:
        body["details"] = exc.details
    headers = {"WWW-Authenticate": "Bearer"} if exc.status_code == 401 else None
    return JSONResponse(status_code=exc.status_code, content=body, headers=headers)


async def unhandled_error_handler(_: Request, exc: Exception) -> JSONResponse:
    """Kutilmagan xato — ichki tafsilot foydalanuvchiga chiqmaydi."""
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "code": "ichki_xato",
            "message": "Tizimda kutilmagan xatolik yuz berdi. Birozdan soʻng qayta urinib koʻring.",
        },
    )
