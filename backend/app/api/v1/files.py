"""Fayl yuklash va yuklab olish (MET-03, NFR-11, X-7).

Ikkita endpoint, ikki xil himoya:

    POST /files            — token bilan. Kim yuklayotgani maʼlum boʻlsin.
    GET  /files/{id}/download — TOKENSIZ, imzo bilan.

Yuklab olish tokensiz, chunki brauzer `<img src>` va `<a href>` ga
`Authorization` sarlavhasini qoʻsha olmaydi. Oʻrniga havolaning oʻzi
imzolangan va 15 daqiqadan keyin oʻladi (X-7).

«Falon faylga havola ber» degan UMUMIY endpoint ATAYLAB YOʻQ: u
boʻlsa har kim istalgan `file_id` ga havola olardi. Havolani faylni
ilova qilgan modul beradi — u oldin oʻz kirish tekshiruvini qiladi
(X-1).
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, File, Query, Request, Response, UploadFile

from app.api.v1.deps import CurrentUserDep
from app.core.db import SessionDep
from app.models import AuditAction
from app.schemas.files import FileOut
from app.services import audit_service, storage

router = APIRouter(prefix="/files", tags=["files"])


@router.post("", response_model=FileOut, status_code=201)
async def upload(
    request: Request,
    user: CurrentUserDep,
    session: SessionDep,
    file: Annotated[UploadFile, File()],
) -> FileOut:
    """Fayl yuklaydi va unga 15 daqiqalik imzolangan havola qaytaradi.

    Hajm chegarasi `storage` da tekshiriladi (MET-03: 200 MB).
    """
    data = await file.read()
    yozuv = await storage.save(
        session, user, data=data, filename=file.filename, content_type=file.content_type
    )
    audit_service.record(
        session,
        object_type="file",
        object_id=yozuv.id,
        action=AuditAction.CREATE,
        new={"name": yozuv.original_name, "size": yozuv.size_bytes},
        actor_id=user.id,
        ip=request.client.host if request.client else None,
    )
    await session.commit()
    return FileOut(
        id=yozuv.id,
        name=yozuv.original_name,
        size_bytes=yozuv.size_bytes,
        content_type=yozuv.content_type,
        url=storage.signed_path(yozuv.id),
    )


@router.get("/{file_id}/download")
async def download(
    file_id: uuid.UUID,
    session: SessionDep,
    exp: Annotated[int, Query()],
    sig: Annotated[str, Query(min_length=64, max_length=64)],
) -> Response:
    """Imzolangan havola boʻyicha faylni beradi.

    Imzo notoʻgʻri yoki muddati tugagan boʻlsa `404` — «imzo xato»
    deyish havolani tanlab koʻrishga yordam berardi.
    """
    storage.verify(file_id, expires=exp, signature=sig)
    yozuv = await storage.get(session, file_id)
    baytlar = storage.read_bytes(yozuv)
    return Response(
        content=baytlar,
        media_type=yozuv.content_type,
        headers={
            # `filename*` — RFC 5987, oʻzbekcha nom buzilmasin.
            "Content-Disposition": f'attachment; filename="{yozuv.original_name}"',
            # Havola qisqa yashaydi; oraliq keshda qolib ketmasin (X-7).
            "Cache-Control": "private, no-store",
        },
    )
