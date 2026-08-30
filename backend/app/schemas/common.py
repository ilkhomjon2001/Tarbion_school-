"""Umumiy sxemalar.

CLAUDE.md: har bir endpoint `response_model` bilan, `dict` qaytarilmaydi.
Xizmat endpointlari ham bundan mustasno emas — aks holda javob shakli
hujjatga tushmaydi va frontend tiplari generatsiya qilinmaydi.
"""

from typing import Literal

from pydantic import BaseModel


class HealthOut(BaseModel):
    status: Literal["ok"]


class ReadinessOut(BaseModel):
    """Ilova soʻrov qabul qilishga tayyormi.

    `database` — bazaga soʻrov yuborib tekshiriladi. Ulanish puli boʻsh
    boʻlsa ham javob beradi: pool_pre_ping yangi ulanish ochadi.
    """

    status: Literal["ok", "degraded"]
    database: bool
