"""Kirish, sessiya va chiqish (T-004). TZ: AUT-01, AUT-05, AUT-06, AUT-08.

Router faqat: validatsiya → servis chaqiruvi → javob. Mantiq
`services/auth_service.py` da.

Refresh token javob TANASIDA qaytmaydi — u `httpOnly; Secure; SameSite`
cookie'da ketadi (DECISIONS.md). JavaScript uni koʻrmaydi, shuning uchun
XSS bilan oʻgʻirlab boʻlmaydi.
"""

import uuid

from fastapi import APIRouter, Request, Response, status
from sqlalchemy import select

from app.api.v1.deps import CurrentUserDep
from app.core.config import settings
from app.core.db import SessionDep
from app.core.exceptions import AuthRequiredError
from app.core.sections import cabinet_of, effective_sections
from app.models import Permission, RoleName, SchoolClass, Student, User
from app.schemas.auth import (
    ChangePasswordIn,
    LoginIn,
    RecoveryCodesIn,
    RecoveryCodesOut,
    ResetConfirmIn,
    ResetQueueRowOut,
    ResetRequestIn,
    ResetRequestOut,
    ResetResolveOut,
    TokenOut,
    TwoFactorDisableIn,
    TwoFactorEnableIn,
    TwoFactorRequiredOut,
    TwoFactorSetupOut,
    TwoFactorStatusOut,
    TwoFactorVerifyIn,
    UserOut,
)
from app.services import (
    auth_service,
    password_reset_service,
    permissions,
    twofactor_service,
    user_service,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        settings.refresh_cookie_name,
        token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,  # type: ignore[arg-type]
        domain=settings.cookie_domain,
        max_age=settings.refresh_token_ttl_days * 24 * 3600,
        path="/api/v1/auth",
    )


async def _user_out(session, user) -> UserOut:  # noqa: ANN001 — SQLAlchemy modeli
    """Kirish javobi.

    Boʻlim va huquqlar SHU YERDA qaytariladi: frontend menyuni oʻzi
    hisoblamasin. Aks holda server bilan farq qilib, odam koʻrgan
    tugmasini bosganda 403 olardi (T-005).
    """
    roles = set(user.role_names)
    berilgan = await permissions.granted_permissions(session, user.id)

    # Oʻquvchi kabineti oʻz yozuvini bilishi kerak (T-034). Bitta soʻrov,
    # faqat oʻquvchi rolida — qolganlarga maydonlar `None` boʻlib qoladi.
    student_id = class_id = class_name = None
    if RoleName.STUDENT.value in roles:
        row = (
            await session.execute(
                select(Student.id, Student.class_id, SchoolClass.name)
                .outerjoin(SchoolClass, SchoolClass.id == Student.class_id)
                .where(Student.user_id == user.id, Student.is_archived.is_(False))
            )
        ).first()
        if row is not None:
            student_id, class_id, class_name = row

    return UserOut(
        id=user.id,
        login=user.login,
        full_name=user.full_name,
        short_name=user.short_name,
        roles=user.role_names,
        must_change_password=user.must_change_password,
        cabinet=cabinet_of(roles),
        sections=effective_sections(roles, user.section_overrides),
        permissions=(
            sorted(p.value for p in Permission)
            if RoleName.SUPERADMIN.value in roles
            else sorted(berilgan)
        ),
        student_id=student_id,
        class_id=class_id,
        class_name=class_name,
    )


@router.post("/login", response_model=TokenOut | TwoFactorRequiredOut)
async def login(
    payload: LoginIn, request: Request, response: Response, session: SessionDep
) -> TokenOut | TwoFactorRequiredOut:
    """Kirish. 2FA yoqilgan boʻlsa TOKEN BERILMAYDI.

    Uning oʻrniga qisqa muddatli `challenge_token` qaytadi va mijoz
    `/auth/2fa/verify` ga kodni yuboradi. Parolni bilgan, lekin kodi
    yoʻq odam hech qanday token olmaydi (X-14).
    """
    user, access, refresh = await auth_service.authenticate(
        session,
        login_raw=payload.login,
        password=payload.password,
        ip=_client_ip(request),
        user_agent=request.headers.get("User-Agent"),
    )

    if user.two_factor_enabled:
        # Berilgan sessiyani darhol bekor qilamiz: `authenticate`
        # tokenlarni yaratib boʻlgan, lekin ikkinchi bosqich
        # oʻtilmagan.
        await auth_service.revoke_session(session, raw_token=refresh)
        return TwoFactorRequiredOut(
            challenge_token=twofactor_service.issue_challenge(user),
            recovery_available=await twofactor_service.unused_recovery_count(session, user.id) > 0,
        )

    _set_refresh_cookie(response, refresh)
    return TokenOut(access_token=access, user=await _user_out(session, user))


@router.post("/2fa/verify", response_model=TokenOut)
async def two_factor_verify(
    payload: TwoFactorVerifyIn,
    request: Request,
    response: Response,
    session: SessionDep,
) -> TokenOut:
    """Kirishning ikkinchi bosqichi: TOTP kodi yoki tiklash kodi."""
    user_id = twofactor_service.read_challenge(payload.challenge_token)
    user = await session.get(User, user_id)
    if user is None or not user.is_active or user.is_archived:
        raise AuthRequiredError

    ip = _client_ip(request)
    await twofactor_service.verify_second_factor(session, user, payload.code, ip=ip)

    access, refresh = await auth_service.issue_session(
        session, user, ip=ip, user_agent=request.headers.get("User-Agent")
    )
    _set_refresh_cookie(response, refresh)
    return TokenOut(access_token=access, user=await _user_out(session, user))


# ─────────────────── 2FA sozlash (X-14) ───────────────────


@router.get("/2fa", response_model=TwoFactorStatusOut)
async def two_factor_status(current: CurrentUserDep, session: SessionDep) -> TwoFactorStatusOut:
    user = await session.get(User, current.id)
    if user is None:
        raise AuthRequiredError
    return TwoFactorStatusOut(
        enabled=user.two_factor_enabled,
        required=twofactor_service.is_required(user),
        unused_recovery_codes=await twofactor_service.unused_recovery_count(session, user.id),
    )


@router.post("/2fa/setup", response_model=TwoFactorSetupOut)
async def two_factor_setup(current: CurrentUserDep, session: SessionDep) -> TwoFactorSetupOut:
    """Sekret yasaydi. 2FA hali YOQILMAYDI — kod tasdiqlangach yoqiladi.

    Shu sabab yarim sozlangan holatda foydalanuvchi qulflanib qolmaydi.
    """
    user = await session.get(User, current.id)
    if user is None:
        raise AuthRequiredError
    natija = await twofactor_service.begin_setup(session, user)
    return TwoFactorSetupOut(secret=natija.secret, uri=natija.uri)


@router.post("/2fa/enable", response_model=RecoveryCodesOut)
async def two_factor_enable(
    payload: TwoFactorEnableIn,
    request: Request,
    current: CurrentUserDep,
    session: SessionDep,
) -> RecoveryCodesOut:
    """Kodni tekshirib yoqadi. Tiklash kodlari BIR MARTA qaytadi."""
    user = await session.get(User, current.id)
    if user is None:
        raise AuthRequiredError
    kodlar = await twofactor_service.enable(session, user, payload.code, ip=_client_ip(request))
    return RecoveryCodesOut(codes=kodlar)


@router.post("/2fa/disable", status_code=status.HTTP_204_NO_CONTENT)
async def two_factor_disable(
    payload: TwoFactorDisableIn,
    request: Request,
    current: CurrentUserDep,
    session: SessionDep,
) -> None:
    """Oʻchiradi. Parol VA kod soʻraladi; majburiy rolda umuman mumkin emas."""
    user = await session.get(User, current.id)
    if user is None:
        raise AuthRequiredError
    await twofactor_service.disable(
        session, user, payload.password, payload.code, ip=_client_ip(request)
    )


@router.post("/2fa/recovery-codes", response_model=RecoveryCodesOut)
async def two_factor_recovery_codes(
    payload: RecoveryCodesIn,
    request: Request,
    current: CurrentUserDep,
    session: SessionDep,
) -> RecoveryCodesOut:
    """Yangi tiklash kodlari. Eskilari bekor qilinadi."""
    user = await session.get(User, current.id)
    if user is None:
        raise AuthRequiredError
    kodlar = await twofactor_service.regenerate_recovery_codes(
        session, user, payload.password, ip=_client_ip(request)
    )
    return RecoveryCodesOut(codes=kodlar)


@router.post("/refresh", response_model=TokenOut)
async def refresh(request: Request, response: Response, session: SessionDep) -> TokenOut:
    raw = request.cookies.get(settings.refresh_cookie_name, "")
    user, access, new_refresh = await auth_service.rotate_refresh(
        session,
        raw_token=raw,
        ip=_client_ip(request),
        user_agent=request.headers.get("User-Agent"),
    )
    _set_refresh_cookie(response, new_refresh)
    return TokenOut(access_token=access, user=await _user_out(session, user))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(request: Request, response: Response, session: SessionDep) -> None:
    await auth_service.revoke_session(
        session, raw_token=request.cookies.get(settings.refresh_cookie_name)
    )
    response.delete_cookie(settings.refresh_cookie_name, path="/api/v1/auth")


@router.get("/me", response_model=UserOut)
async def me(user: CurrentUserDep, session: SessionDep) -> UserOut:
    """Joriy foydalanuvchi — boʻlim va huquqlari bilan.

    Sahifa yangilanganda frontend menyuni shu javobdan tiklaydi.
    Bazadan qayta oʻqiladi: super administrator huquqni olib qoʻygan
    boʻlsa, eski token bilan eski menyu ishlab ketmasin.
    """
    db_user = await session.get(User, user.id)
    if db_user is None:
        raise AuthRequiredError
    return await _user_out(session, db_user)


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    payload: ChangePasswordIn,
    request: Request,
    current: CurrentUserDep,
    session: SessionDep,
) -> None:
    """Foydalanuvchi oʻz parolini almashtiradi.

    Boshlangʻich 5 xonali parol shu yerda doimiysiga almashtiriladi va
    `must_change_password` oʻchadi.
    """
    user = await session.get(User, current.id)
    if user is None:
        raise AuthRequiredError

    await user_service.change_own_password(
        session,
        user=user,
        current_password=payload.current_password,
        new_password=payload.new_password,
        ip=_client_ip(request),
    )


# ─────────────────── Parolni tiklash (T-006, AUT-02) ───────────────────

#: Soʻrovga qaytariladigan yagona javob. Raqam topildimi-yoʻqmi —
#: farqi yoʻq: aks holda begona odam raqamlarni sinab, qaysi oila
#: maktabda ekanini aniqlab olardi.
_RESET_JAVOB = (
    "Agar bu maʼlumot tizimda mavjud boʻlsa, tiklash yoʻriqnomasi yuborildi. "
    "Xabar kelmasa maktab administratoriga murojaat qiling."
)


@router.post("/password-reset/request", response_model=ResetRequestOut)
async def reset_request(
    payload: ResetRequestIn, request: Request, session: SessionDep
) -> ResetRequestOut:
    """Tiklash soʻrovi — telefon yoki login boʻyicha. Autentifikatsiyasiz.

    Telefon: Telegram ulangan boʻlsa 6 raqamli kod yuboriladi.
    Login yoki Telegramsiz hisob: soʻrov administrator navbatiga tushadi.
    """
    if payload.phone:
        await password_reset_service.request_by_phone(
            session, phone=payload.phone, ip=_client_ip(request)
        )
    elif payload.login:
        await password_reset_service.request_by_login(
            session, login=payload.login, ip=_client_ip(request)
        )
    return ResetRequestOut(message=_RESET_JAVOB)


@router.post("/password-reset/confirm", status_code=status.HTTP_204_NO_CONTENT)
async def reset_confirm(
    payload: ResetConfirmIn, request: Request, session: SessionDep
) -> None:
    """Kod bilan yangi parol oʻrnatiladi. Barcha sessiyalar bekor qilinadi."""
    await password_reset_service.confirm(
        session,
        phone=payload.phone,
        code=payload.code,
        new_password=payload.new_password,
        ip=_client_ip(request),
    )


@router.get("/password-reset/queue", response_model=list[ResetQueueRowOut])
async def reset_queue(user: CurrentUserDep, session: SessionDep) -> list[ResetQueueRowOut]:
    """Administrator navbati. Huquq: `users.reset_password`."""
    rows = await password_reset_service.pending(session, user)
    return [
        ResetQueueRowOut(
            id=r.id,
            user_id=r.user_id,
            full_name=r.full_name,
            login=r.login,
            roles=r.roles,
            phone_masked=r.phone_masked,
            created_at=r.created_at,
        )
        for r in rows
    ]


@router.post("/password-reset/queue/{request_id}/resolve", response_model=ResetResolveOut)
async def reset_resolve(
    request_id: uuid.UUID, request: Request, user: CurrentUserDep, session: SessionDep
) -> ResetResolveOut:
    """Administrator yangi parol beradi. Parol FAQAT shu javobda koʻrinadi."""
    login, parol = await password_reset_service.resolve(
        session, actor=user, request_id=request_id, ip=_client_ip(request)
    )
    return ResetResolveOut(login=login, password=parol)
