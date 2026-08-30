"""Ism-familiyadan login yasash.

Login foydalanuvchi tanlamaydi — administrator hisob ochganda tizim
yasaydi. Sabab: maktabda 1000 dan ortiq hisob boʻladi va odamlar
tanlagan login bilan "kim kim ekanini" aniqlash imkonsiz boʻlib qoladi.

Format: `familiya.ism` — masalan `aliyev.sardor`.
Takrorlansa oxiriga raqam qoʻshiladi: `aliyev.sardor2`.

Nega familiya oldinda: maktab jurnallari familiya boʻyicha tartiblanadi,
roʻyxatda qidirish oson boʻladi.
"""

import re
import unicodedata

# Oʻzbek lotin alifbosidagi maxsus belgilar. `ʻ` (U+02BB) va `ʼ` (U+02BC)
# tashlab yuboriladi: `Gʻofurov` → `gofurov`, `Saʼdulla` → `sadulla`.
_LATIN_MAP = {
    "ʻ": "",
    "ʼ": "",
    "'": "",
    "`": "",
    "‘": "",
    "’": "",
}

# Kirill alifbosi — ismlar kirillcha kiritilishi mumkin.
_CYRILLIC_MAP = {
    "а": "a",
    "б": "b",
    "в": "v",
    "г": "g",
    "д": "d",
    "е": "e",
    "ё": "yo",
    "ж": "j",
    "з": "z",
    "и": "i",
    "й": "y",
    "к": "k",
    "л": "l",
    "м": "m",
    "н": "n",
    "о": "o",
    "п": "p",
    "р": "r",
    "с": "s",
    "т": "t",
    "у": "u",
    "ф": "f",
    "х": "x",
    "ц": "s",
    "ч": "ch",
    "ш": "sh",
    "щ": "sh",
    "ъ": "",
    "ы": "i",
    "ь": "",
    "э": "e",
    "ю": "yu",
    "я": "ya",
    # Oʻzbek kirillchasidagi qoʻshimcha harflar
    "ў": "o",
    "қ": "q",
    "ғ": "g",
    "ҳ": "h",
}

_ALLOWED = re.compile(r"[^a-z0-9]")

#: Login uzunligi chegarasi — bazadagi ustun kengligi bilan bir xil.
MAX_LOGIN_LENGTH = 64


def transliterate(text: str) -> str:
    """Ismni ASCII harflarga keltiradi.

    Kirillcha, oʻzbekcha apostroflar va diakritik belgilar tozalanadi.
    Natijada faqat `a-z` va `0-9` qoladi.
    """
    s = text.strip().lower()

    for src, dst in _LATIN_MAP.items():
        s = s.replace(src, dst)
    for src, dst in _CYRILLIC_MAP.items():
        s = s.replace(src, dst)

    # Qolgan diakritiklar (masalan `é`, `ü`) asosiy harfga tushiriladi.
    s = unicodedata.normalize("NFKD", s)
    s = "".join(ch for ch in s if not unicodedata.combining(ch))

    return _ALLOWED.sub("", s)


def build_login(last_name: str, first_name: str) -> str:
    """`familiya.ism` koʻrinishidagi asosiy login.

    Takrorlanishni bu funksiya tekshirmaydi — bazani biladigan qatlam
    (`user_service`) `next_free_login()` orqali hal qiladi.
    """
    familiya = transliterate(last_name)
    ism = transliterate(first_name)

    if not familiya and not ism:
        raise ValueError("Ism va familiyadan login yasab boʻlmadi.")

    base = f"{familiya}.{ism}" if familiya and ism else (familiya or ism)
    return base[:MAX_LOGIN_LENGTH]


def login_variant(base: str, index: int) -> str:
    """Band boʻlgan loginning navbatdagi varianti.

    `index=1` asosiy login, keyingilariga raqam qoʻshiladi. Raqam
    sigʻmasa, asosiy qism qisqartiriladi — kesib tashlash raqamni
    yoʻqotib, cheksiz sikl hosil qilardi.
    """
    if index <= 1:
        return base[:MAX_LOGIN_LENGTH]

    suffix = str(index)
    kesim = MAX_LOGIN_LENGTH - len(suffix)
    return f"{base[:kesim]}{suffix}"
