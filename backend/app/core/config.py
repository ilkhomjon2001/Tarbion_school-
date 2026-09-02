"""Muhit sozlamalari. Barcha sekret .env dan olinadi, kodda yozilmaydi."""

from functools import lru_cache
from typing import Annotated

from pydantic import Field, PostgresDsn, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

#: `.env.example` va hujjatlarda uchraydigan qiymatlar. Ular ishlab
#: chiqarishga oʻtib ketmasin.
_KNOWN_WEAK_SECRETS = frozenset(
    {
        "change-me",
        "secret",
        "changeme-32-characters-minimum-length",
        "dev-secret-key-change-in-production-32",
    }
)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # --- Umumiy ---
    app_env: str = "development"
    debug: bool = False
    # Interfeys va hisobotlar shu mintaqada ko'rsatiladi. Bazada har doim UTC
    # (CLAUDE.md 3-qoida).
    display_timezone: str = "Asia/Tashkent"

    # --- Baza ---
    database_url: PostgresDsn
    # Testlar ALOHIDA bazada ishlaydi. Berilmasa testlar ishga tushmaydi —
    # bu ataylab: sukut bo'yicha ishchi bazaga tushib qolish xavfli.
    test_database_url: PostgresDsn | None = None
    # NFR-02: 500 ta bir vaqtdagi faol foydalanuvchi. Bitta uvicorn worker uchun
    # pool 20 + overflow 10 yetarli; worker soni gorizontal kengaytiriladi.
    db_pool_size: int = 20
    db_max_overflow: int = 10
    db_pool_timeout: int = 10
    db_pool_recycle: int = 1800
    db_echo: bool = False

    # --- Auth (AUT-01, AUT-05, AUT-06) ---
    jwt_secret: str = Field(min_length=32)
    jwt_algorithm: str = "HS256"
    access_token_ttl_minutes: int = 15
    refresh_token_ttl_days: int = 30
    # AUT-05: ketma-ket 5 marta noto'g'ri parol → 15 daqiqa blok
    login_max_attempts: int = 5
    login_lockout_minutes: int = 15
    login_attempt_window_minutes: int = 15
    # Parol purkashga qarshi: bitta IP dan oynada nechta TURLI login
    # boʻyicha xato boʻlgani. Xatolar SONI emas, aynan turli loginlar
    # soni — butun maktab bitta NAT ortidan chiqadi va oddiy xatolar
    # hammani bloklab qoʻymasligi kerak. Bitta odam 15 ta boshqa
    # odamning loginini terib koʻrmaydi.
    login_max_logins_per_ip: int = 15

    # X-14: administrator va direktorga 2FA majburiymi.
    #
    # Sukut boʻyicha YOQIQ — xavfsiz standart. Sinov muhitida oʻchirish
    # mumkin: har testda autentifikator ilovasini ochish ish jarayonini
    # toʻsadi. Oʻchirilganda 2FA FUNKSIYASI qoladi — foydalanuvchi uni
    # istasa yoqadi, faqat majburlanmaydi.
    require_two_factor: bool = True

    #: Telegram bot tokeni (T-017, @BotFather beradi). Boʻsh boʻlsa
    #: xabarnoma worker'i ishga tushmaydi — navbat toʻlib boraveradi
    #: va token qoʻyilganda hammasi yetkaziladi, hech narsa yoʻqolmaydi.
    telegram_bot_token: str = ""

    #: Worker navbatni qanchada bir tekshiradi. Ilova B: «farzand
    #: darsga kelmadi» xabari davomat belgilangach 30 daqiqa ichida
    #: yetishi kerak — 30 soniya bu muddatga keng zaxira qoldiradi.
    outbox_poll_seconds: int = 30

    #: Bir siklda nechta xabar olinadi.
    outbox_batch_size: int = 50

    #: Sinov toʻlov provayderi webhook imzosi kaliti. Haqiqiy provayder
    #: kelganda uning kaliti alohida nom bilan qoʻshiladi.
    sinov_provider_key: str = "sinov-kalit-almashtiring"  # noqa: S105
    #: Oylik toʻlov shu sanagacha kutiladi; undan keyin «kechikdi».
    payment_due_day: int = 10

    # --- Cookie ---
    refresh_cookie_name: str = "tarbion_rt"
    # Ishlab chiqarishda majburiy True (NFR-07: barcha aloqa HTTPS).
    cookie_secure: bool = True
    cookie_samesite: str = "lax"
    cookie_domain: str | None = None

    # --- CORS ---
    # `NoDecode` shart: pydantic-settings murakkab tipni .env dan o'qiyotganda
    # avval JSON deb parse qilishga urinadi va "http://a,http://b" da yiqiladi.
    # NoDecode bilan xom qator validatorga yetib keladi.
    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:3000"]

    # --- Proksi ---
    # Caddy/nginx ortida turganda `X-Forwarded-For` FAQAT shu manzillardan
    # oʻqiladi. Boʻsh boʻlsa sarlavha butunlay eʼtiborga olinmaydi —
    # aks holda har kim oʻzini boshqa IP deb koʻrsatib, bloklashni
    # aylanib oʻtardi.
    trusted_proxies: Annotated[list[str], NoDecode] = []

    # --- Domen qoidalari ---
    # DAV-03: davomat dars TUGAGANIDAN keyin 24 soat ustoz uchun ochiq.
    attendance_edit_window_hours: int = 24

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, v: object) -> object:
        if isinstance(v, str):
            return [o.strip() for o in v.split(",") if o.strip()]
        return v

    @field_validator("trusted_proxies", mode="before")
    @classmethod
    def _split_proxies(cls, v: object) -> object:
        if isinstance(v, str):
            return [o.strip() for o in v.split(",") if o.strip()]
        return v

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @model_validator(mode="after")
    def _assert_production_safe(self) -> "Settings":
        """Ishlab chiqarishda xavfli sozlama bilan ishga tushmaydi.

        Sozlama xatosi eng koʻp uchraydigan zaiflik manbai: kimdir
        `.env` ni nusxalaydi va `COOKIE_SECURE=false` yoki sinov
        `JWT_SECRET` i ishlab chiqarishga oʻtib ketadi. Bunday holatda
        jimgina ishlashdan koʻra ishga tushmagani xavfsizroq.
        """
        if not self.is_production:
            return self

        xatolar: list[str] = []

        if not self.cookie_secure:
            xatolar.append("COOKIE_SECURE=false — refresh cookie HTTP orqali ketadi")
        if self.debug:
            xatolar.append("DEBUG=true — xato tafsilotlari tashqariga chiqadi")
        if any(o.startswith("http://") for o in self.cors_origins):
            xatolar.append("CORS_ORIGINS da http:// manzil bor")
        if "*" in self.cors_origins:
            xatolar.append("CORS_ORIGINS = '*' — cookie bilan birga xavfli")
        if self.jwt_secret in _KNOWN_WEAK_SECRETS:
            xatolar.append("JWT_SECRET namunadagi qiymat — almashtiring")
        if len(set(self.jwt_secret)) < 8:
            xatolar.append("JWT_SECRET juda oddiy")

        if self.sinov_provider_key == "sinov-kalit-almashtiring":  # noqa: S105
            xatolar.append(
                "SINOV_PROVIDER_KEY namunadagi qiymat — toʻlov webhooki imzosi shu kalitga tayanadi"
            )
        if not self.trusted_proxies:
            xatolar.append(
                "TRUSTED_PROXIES boʻsh — Caddy ortida audit va "
                "login-lockout IP lari 127.0.0.1 boʻlib qoladi"
            )

        if xatolar:
            ro_yxat = "; ".join(xatolar)
            raise ValueError(f"Ishlab chiqarish sozlamasi xavfli: {ro_yxat}")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]


settings = get_settings()
