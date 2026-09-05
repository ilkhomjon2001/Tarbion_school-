"""Fayl sxemalari (MET-03).

`storage_key` va `uploaded_by_id` ATAYLAB chiqmaydi (X-5): diskdagi
tuzilma tashqariga koʻrsatilmaydi.
"""

import uuid

from pydantic import BaseModel


class FileOut(BaseModel):
    id: uuid.UUID
    name: str
    size_bytes: int
    content_type: str
    #: Imzolangan yuklab olish yoʻli — 15 daqiqa amal qiladi (X-7).
    url: str
