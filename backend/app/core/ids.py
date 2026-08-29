"""UUIDv7 generatori.

Nega uuid4 emas: uuid4 tasodifiy, shuning uchun har insert btree indeksning
tasodifiy sahifasiga tushadi va katta jadvalda sahifa bo'linishi ko'payadi.
uuid7 vaqt bo'yicha o'sadi — insert har doim indeks oxiriga tushadi, ya'ni
`attendance_records` va `audit_log` kabi tez o'sadigan jadvallarda yozish
sezilarli tez bo'ladi va indeks kamroq shishadi.

Format: RFC 9562 UUIDv7 — 48 bit unix_ts_ms + 4 bit versiya + 12 bit rand_a
+ 2 bit variant + 62 bit rand_b.
"""

import os
import time
import uuid


def uuid7() -> uuid.UUID:
    ts_ms = int(time.time() * 1000) & 0xFFFFFFFFFFFF  # 48 bit
    rand = int.from_bytes(os.urandom(10), "big")

    rand_a = (rand >> 62) & 0xFFF  # 12 bit
    rand_b = rand & 0x3FFFFFFFFFFFFFFF  # 62 bit

    value = ts_ms << 80
    value |= 0x7 << 76  # versiya 7
    value |= rand_a << 64
    value |= 0b10 << 62  # RFC 4122 variant
    value |= rand_b

    return uuid.UUID(int=value)
