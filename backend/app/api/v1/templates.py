"""Xabar shablonlari (T-019, BOT-05).

Administrator ota-onalarga ketadigan matnlarni tahrirlaydi. Huquq:
`announcements.publish` — bu ham ommaviy matn, ham oʻsha odamlar
tomonidan boshqariladi.

Sukut matnlar `template_service.DEFAULTS` da; bu yerdan faqat ustama
yoziladi va «sukutga qaytarish» ham bor.
"""

from fastapi import APIRouter, Request

from app.api.v1.deps import CurrentUserDep
from app.core.db import SessionDep
from app.schemas.templates import TemplateIn, TemplateOut
from app.services import template_service

router = APIRouter(prefix="/message-templates", tags=["templates"])


def _client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


def _out(t: template_service.Template) -> TemplateOut:
    return TemplateOut(
        kind=t.kind,
        label=t.label,
        title=t.title,
        body=t.body,
        fields=list(t.fields),
        customized=t.customized,
    )


@router.get("", response_model=list[TemplateOut])
async def list_templates(user: CurrentUserDep, session: SessionDep) -> list[TemplateOut]:
    return [_out(t) for t in await template_service.list_all(session, user)]


@router.put("/{kind}", response_model=TemplateOut)
async def set_template(
    kind: str,
    payload: TemplateIn,
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
) -> TemplateOut:
    """Matnni oʻzgartiradi. Nomaʼlum `{maydon}` — `422`."""
    t = await template_service.set_template(
        session,
        actor=user,
        kind=kind,
        title=payload.title,
        body=payload.body,
        ip=_client_ip(request),
    )
    return _out(t)


@router.post("/{kind}/reset", response_model=TemplateOut)
async def reset_template(
    kind: str, request: Request, user: CurrentUserDep, session: SessionDep
) -> TemplateOut:
    """Sukut matnga qaytaradi. Ustama arxivlanadi, oʻchirilmaydi."""
    t = await template_service.reset(
        session, actor=user, kind=kind, ip=_client_ip(request)
    )
    return _out(t)


__all__ = ["router"]
