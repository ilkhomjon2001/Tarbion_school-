"""Huquqlar markazi sxemalari (T-005)."""

import uuid

from pydantic import BaseModel, Field


class SectionOut(BaseModel):
    """Reyestrdagi bitta boʻlim."""

    id: str
    label: str
    cabinet: str
    #: Kabinet boshi — oʻchirib boʻlmaydi.
    locked: bool
    #: Faqat super administrator koʻradi.
    superadmin_only: bool


class PermissionOut(BaseModel):
    """Huquq va uning oʻzbekcha izohi."""

    code: str
    label: str
    group: str


class UserAccessOut(BaseModel):
    """Foydalanuvchining toʻliq kirish holati."""

    user_id: uuid.UUID
    login: str
    full_name: str
    roles: list[str]
    cabinet: str
    is_active: bool
    is_archived: bool
    #: Haqiqatda koʻradigan boʻlimlar.
    sections: list[str]
    #: Rol standarti — interfeys farqni koʻrsatishi uchun.
    default_sections: list[str]
    #: Boʻlimlar qoʻlda oʻzgartirilganmi.
    customized: bool
    permissions: list[str]


class SetSectionsIn(BaseModel):
    """`None` — istisnoni bekor qilib rol standartiga qaytarish."""

    sections: list[str] | None = Field(default=None, max_length=200)


class SetPermissionsIn(BaseModel):
    """Toʻliq roʻyxat — qoʻshish/olib tashlash emas."""

    permissions: list[str] = Field(default_factory=list, max_length=50)
