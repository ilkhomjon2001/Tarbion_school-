"""Huquqlar markazi endpointlari (T-005).

Super administrator shu yerdan boshqaradi: kim qaysi boʻlimni koʻradi
va kim qaysi amalni bajaradi.

Har bir endpoint ichida `access_admin` tekshiradi — routerda rol
darvozasi yoʻq. Sabab: `permissions.grant` huquqi berilgan administrator
ham bu yerga kira oladi, faqat superadmin emas.
"""

import uuid

from fastapi import APIRouter, Query, Request

from app.api.v1.deps import CurrentUserDep
from app.core.db import SessionDep
from app.core.sections import SECTIONS
from app.models import Permission
from app.schemas.access import (
    PermissionOut,
    SectionOut,
    SetPermissionsIn,
    SetSectionsIn,
    UserAccessOut,
)
from app.services import access_admin
from app.services.access_admin import UserAccess

router = APIRouter(prefix="/access", tags=["access"])

#: Huquqlarning oʻzbekcha nomi va guruhi — interfeys shu roʻyxatdan
#: chiziladi, frontendda takrorlanmaydi.
PERMISSION_LABELS: dict[str, tuple[str, str]] = {
    Permission.USERS_CREATE.value: ("Hisob ochish", "Foydalanuvchilar"),
    Permission.USERS_MANAGE.value: ("Hisobni tahrirlash va arxivlash", "Foydalanuvchilar"),
    Permission.USERS_RESET_PASSWORD.value: ("Parolni tiklash", "Foydalanuvchilar"),
    Permission.PERMISSIONS_GRANT.value: ("Boshqalarga huquq berish", "Foydalanuvchilar"),
    Permission.ATTENDANCE_EDIT_CLOSED.value: (
        "Muddati oʻtgan davomatni tuzatish",
        "Oʻquv jarayoni",
    ),
    Permission.SCHEDULE_MANAGE.value: ("Dars jadvalini tuzish", "Oʻquv jarayoni"),
    Permission.STUDENTS_MANAGE.value: ("Oʻquvchi qabul qilish va koʻchirish", "Oʻquv jarayoni"),
    Permission.PAYMENTS_MANAGE.value: ("Toʻlov kiritish va storno", "Moliya"),
    Permission.REPORTS_EXPORT.value: ("Roʻyxatlarni yuklab olish", "Hisobot"),
    Permission.REPORTS_VIEW_ALL.value: ("Butun maktab hisobotlari", "Hisobot"),
    Permission.ANNOUNCEMENTS_PUBLISH.value: ("Ommaviy eʼlon yuborish", "Aloqa"),
}


def _to_out(a: UserAccess) -> UserAccessOut:
    return UserAccessOut(
        user_id=a.user.id,
        login=a.user.login,
        full_name=a.user.full_name,
        roles=a.roles,
        cabinet=a.cabinet,
        is_active=a.user.is_active,
        is_archived=a.user.is_archived,
        sections=a.sections,
        default_sections=a.default_sections,
        customized=a.customized,
        permissions=a.permissions,
    )


def _client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


@router.get("/sections", response_model=list[SectionOut])
async def sections(user: CurrentUserDep) -> list[SectionOut]:
    """Boʻlimlar reyestri.

    Bu shunchaki roʻyxat — hech kimning maʼlumoti yoʻq, shuning uchun
    har bir kirgan foydalanuvchiga ochiq. Kim NIMANI koʻrishi esa
    `/access/users/{id}` da.
    """
    return [
        SectionOut(
            id=s.id,
            label=s.label,
            cabinet=s.cabinet,
            locked=s.locked,
            superadmin_only=s.superadmin_only,
        )
        for s in SECTIONS
    ]


@router.get("/permissions", response_model=list[PermissionOut])
async def permission_registry(user: CurrentUserDep) -> list[PermissionOut]:
    """Huquqlar reyestri — oʻzbekcha nomi va guruhi bilan."""
    return [
        PermissionOut(code=code, label=label, group=group)
        for code, (label, group) in PERMISSION_LABELS.items()
    ]


@router.get("/users", response_model=list[UserAccessOut])
async def users(
    user: CurrentUserDep,
    session: SessionDep,
    q: str | None = Query(default=None, description="Login yoki ism boʻyicha qidirish"),
    limit: int = Query(default=100, le=500),
) -> list[UserAccessOut]:
    rows = await access_admin.list_users(session, actor=user, query=q, limit=limit)
    return [_to_out(a) for a in rows]


@router.get("/users/{user_id}", response_model=UserAccessOut)
async def user_access(
    user_id: uuid.UUID, user: CurrentUserDep, session: SessionDep
) -> UserAccessOut:
    """Bitta foydalanuvchining kirish holati.

    Har kim OʻZ holatini koʻra oladi — kabinet menyusi shundan
    chiziladi. Boshqasiniki uchun huquq kerak.
    """
    if user_id != user.id:
        await access_admin._assert_can_manage(session, user)  # noqa: SLF001
    return _to_out(await access_admin.get_access(session, user_id))


@router.put("/users/{user_id}/sections", response_model=UserAccessOut)
async def set_sections(
    user_id: uuid.UUID,
    payload: SetSectionsIn,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> UserAccessOut:
    """Foydalanuvchi koʻradigan boʻlimlarni belgilaydi.

    `sections: null` — istisnoni bekor qilib rol standartiga qaytaradi.
    """
    a = await access_admin.set_sections(
        session,
        actor=user,
        user_id=user_id,
        sections=payload.sections,
        ip=_client_ip(request),
    )
    return _to_out(a)


@router.put("/users/{user_id}/permissions", response_model=UserAccessOut)
async def set_permissions(
    user_id: uuid.UUID,
    payload: SetPermissionsIn,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> UserAccessOut:
    """Huquqlarni toʻliq almashtiradi (qoʻshish/olib tashlash emas)."""
    a = await access_admin.set_permissions(
        session,
        actor=user,
        user_id=user_id,
        wanted=payload.permissions,
        ip=_client_ip(request),
    )
    return _to_out(a)
