"""Telefon raqamini yagona koʻrinishga keltirish.

Bazada raqam har doim `+998XXXXXXXXX` shaklida. Odam esa uni
«90 123 45 67», «(90) 1234567», «+998 90 123-45-67» deb yozadi —
parolni tiklashda bu farq raqam «topilmadi» boʻlib chiqardi.

Alohida modul: normalizatsiya import skriptida ham, tiklashda ham bir
xil boʻlishi shart. Ikki nusxa vaqt oʻtib bir-biridan ajralib qoladi
va oʻshanda import qilingan raqam tiklashda topilmay qoladi.
"""

from __future__ import annotations

import re

#: Oʻzbekiston raqami: operator kodi + 7 raqam.
_MILLIY_UZUNLIK = 9
_XALQARO_UZUNLIK = 12
_KOD = "998"


def normalize_phone(raw: str | None) -> str | None:
    """`+998XXXXXXXXX` qaytaradi. Tanib boʻlmasa — `None`.

    `None` «xato» degani emas: chaqiruvchi buni «bunday raqam yoʻq»
    bilan BIR XIL koʻrsatishi kerak, aks holda javobning oʻzi
    raqamning bazada bor-yoʻqligini oshkor qilardi.
    """
    if not raw:
        return None
    raqamlar = "".join(re.findall(r"\d", raw))
    if len(raqamlar) == _MILLIY_UZUNLIK:
        return "+" + _KOD + raqamlar
    if len(raqamlar) == _XALQARO_UZUNLIK and raqamlar.startswith(_KOD):
        return "+" + raqamlar
    return None


def mask_phone(phone: str | None) -> str:
    """Interfeysda koʻrsatish uchun: `+998 90 *** ** 67`.

    Administrator navbatida toʻliq raqam kerak emas — u kimligini
    ismidan biladi. X-6: shaxsiy maʼlumot faqat zarur joyda.
    """
    if not phone or len(phone) < 6:
        return "—"
    return f"{phone[:7]} *** ** {phone[-2:]}"
