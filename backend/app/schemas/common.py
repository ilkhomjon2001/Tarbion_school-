"""Umumiy sxemalar.

CLAUDE.md: har bir endpoint `response_model` bilan, `dict` qaytarilmaydi.
Xizmat endpointlari ham bundan mustasno emas — aks holda javob shakli
hujjatga tushmaydi va frontend tiplari generatsiya qilinmaydi.
"""

from typing import Literal

from pydantic import BaseModel


class HealthOut(BaseModel):
    status: Literal["ok"]
