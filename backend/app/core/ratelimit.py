"""Soʻrovlar chastotasini cheklash.

**Redis ishlatilmaydi** (DECISIONS.md), shuning uchun hisob jarayon
XOTIRASIDA yuritiladi. Buning ikkita cheklovi bor va ularni bilib
turish kerak:

1. **Har worker oʻz hisobini yuritadi.** Ikkita uvicorn worker'da
   amaldagi chegara ikki barobar boʻladi. Bu qabul qilingan: chegaralar
   ataylab keng qoʻyilgan va ular aniq hisob emas, HIMOYA vositasi.

2. **Qayta ishga tushganda nolga tushadi.** Uzoq muddatli sekin hujum
   uchun bu yetarli emas — lekin bunday hujumni `login_attempts` va
   audit jurnali ushlaydi.

Nega baza emas: har soʻrovda `INSERT` + `COUNT` qilish 30-80 RPS da
bazaga keraksiz yuk beradi va rate limit'ning oʻzi eng qimmat soʻrovga
aylanadi. Kirish uchun baza ishlatiladi (u kam va uzoq muddatli
hisobni talab qiladi), qolgani uchun xotira yetarli.

Algoritm — sirpanuvchi oyna (sliding window). Token bucket'dan
tanlandi, chunki "daqiqada N ta" degan chegarani odam boshqacha emas,
aynan shunday tushunadi.
"""

import time
from collections import deque
from dataclasses import dataclass, field
from threading import Lock

#: Kalitlar soni shundan oshsa eng eski yarmi tashlanadi. Xotira
#: chegarasiz oʻsmasin: har xil IP dan kelgan soʻrov yangi kalit ochadi
#: va bu oʻzi bir DoS turi boʻlardi.
MAX_KEYS = 20_000


@dataclass(slots=True)
class Limit:
    """`requests` ta soʻrov `window` soniyada."""

    requests: int
    window: int


@dataclass(slots=True)
class _Bucket:
    hits: deque[float] = field(default_factory=deque)


class SlidingWindowLimiter:
    """Jarayon xotirasidagi sirpanuvchi oyna.

    Thread-safe: uvicorn bir nechta oqimda ishlashi mumkin.
    """

    def __init__(self) -> None:
        self._buckets: dict[str, _Bucket] = {}
        self._lock = Lock()

    def check(self, key: str, limit: Limit) -> tuple[bool, int]:
        """(ruxsat, necha soniyadan keyin qayta urinish mumkin)."""
        hozir = time.monotonic()
        chegara = hozir - limit.window

        with self._lock:
            if len(self._buckets) > MAX_KEYS:
                self._trim(chegara)

            bucket = self._buckets.get(key)
            if bucket is None:
                bucket = _Bucket()
                self._buckets[key] = bucket

            # Oynadan chiqqan urinishlarni tashlaymiz.
            while bucket.hits and bucket.hits[0] < chegara:
                bucket.hits.popleft()

            if len(bucket.hits) >= limit.requests:
                kutish = int(bucket.hits[0] + limit.window - hozir) + 1
                return False, max(kutish, 1)

            bucket.hits.append(hozir)
            return True, 0

    def _trim(self, chegara: float) -> None:
        """Boʻsh va eskirgan kalitlarni tozalaydi.

        `_lock` ushlab turilgan holatda chaqiriladi.
        """
        olib_tashlash = [k for k, b in self._buckets.items() if not b.hits or b.hits[-1] < chegara]
        for k in olib_tashlash:
            del self._buckets[k]

        # Hali ham koʻp boʻlsa — eng eskilarini tashlaymiz. Bu
        # chegarani yumshatadi, lekin xotira toʻlib qolishidan yaxshi.
        if len(self._buckets) > MAX_KEYS:
            tartibli = sorted(self._buckets.items(), key=lambda kv: kv[1].hits[-1])
            for k, _ in tartibli[: len(self._buckets) - MAX_KEYS // 2]:
                del self._buckets[k]

    def reset(self) -> None:
        """Faqat testlar uchun."""
        with self._lock:
            self._buckets.clear()


limiter = SlidingWindowLimiter()
