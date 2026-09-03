"""Xabar shablonlari sxemalari (T-019, BOT-05)."""

from pydantic import BaseModel, Field


class TemplateOut(BaseModel):
    kind: str
    #: Administrator ekranida koʻrinadigan nom.
    label: str
    title: str
    body: str
    #: Shu turda ishlatish mumkin boʻlgan maydonlar — interfeys ularni
    #: tugma sifatida koʻrsatadi, odam qoʻlda yozib xato qilmasin.
    fields: list[str]
    #: `false` — sukut matn ishlayapti, hech kim tahrirlamagan.
    customized: bool


class TemplateIn(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    body: str = Field(min_length=1, max_length=1000)
