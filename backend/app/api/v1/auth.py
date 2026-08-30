"""Kirish, sessiya va chiqish (T-004). TZ: AUT-01, AUT-05, AUT-06, AUT-08.

Router faqat: validatsiya → servis chaqiruvi → javob. Mantiq
`services/auth_service.py` da.

Refresh token javob TANASIDA qaytmaydi — u `httpOnly; Secure; SameSite`
cookie'da ketadi (DECISIONS.md). JavaScript uni koʻrmaydi, shuning uchun
XSS bilan oʻgʻirlab boʻlmaydi.
"""

from fastapi import APIRouter, Request, Response, status

from app.api.v1.deps import CurrentUserDep
from app.core.config import settings
from app.core.db import SessionDep
from app.core.exceptions import AuthRequiredError
from app.models import User
from app.schemas.auth import ChangePasswordIn, LoginIn, TokenOut, UserOut
from app.services import auth_service, user_service

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


def _user_out(user) -> UserOut:  # noqa: ANN001 — SQLAlchemy modeli
    return UserOut(
        id=user.id,
        login=user.login,
        full_name=user.full_name,
        short_name=user.short_name,
        roles=user.role_names,
        must_change_password=user.must_change_password,
    )


@router.post("/login", response_model=TokenOut)
async def login(
    payload: LoginIn, request: Request, response: Response, session: SessionDep
) -> TokenOut:
    user, access, refresh = await auth_service.authenticate(
        session,
        login_raw=payload.login,
        password=payload.password,
        ip=_client_ip(request),
        user_agent=request.headers.get("User-Agent"),
    )
    _set_refresh_cookie(response, refresh)
    return TokenOut(access_token=access, user=_user_out(user))


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
    return TokenOut(access_token=access, user=_user_out(user))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(request: Request, response: Response, session: SessionDep) -> None:
    await auth_service.revoke_session(
        session, raw_token=request.cookies.get(settings.refresh_cookie_name)
    )
    response.delete_cookie(settings.refresh_cookie_name, path="/api/v1/auth")


@router.get("/me", response_model=UserOut)
async def me(user: CurrentUserDep) -> UserOut:
    return UserOut(
        id=user.id,
        login=user.login,
        full_name=user.full_name,
        short_name=user.short_name,
        roles=sorted(user.roles),
        must_change_password=user.must_change_password,
    )


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
