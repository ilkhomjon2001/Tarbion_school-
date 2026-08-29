"""Muhit sozlamalari. Barcha sekret .env dan olinadi, kodda yozilmaydi."""

from functools import lru_cache

from pydantic import Field, PostgresDsn, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # --- Umumiy ---
    app_env: str = "development"
    debug: bool = False
    # Interfeys va hisobotlar shu mintaqada ko'rsatiladi. Bazada har doim UTC
    # (CLAUDE.md 3-qoida).
    display_timezone: str = "Asia/Tashkent"

    # --- Baza ---
    database_url: PostgresDsn
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

    # --- Cookie ---
    refresh_cookie_name: str = "tarbion_rt"
    # Ishlab chiqarishda majburiy True (NFR-07: barcha aloqa HTTPS).
    cookie_secure: bool = True
    cookie_samesite: str = "lax"
    cookie_domain: str | None = None

    # --- CORS ---
    cors_origins: list[str] = ["http://localhost:3000"]

    # --- Domen qoidalari ---
    # DAV-03: davomat dars TUGAGANIDAN keyin 24 soat ustoz uchun ochiq.
    attendance_edit_window_hours: int = 24

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, v: object) -> object:
        if isinstance(v, str):
            return [o.strip() for o in v.split(",") if o.strip()]
        return v

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]


settings = get_settings()
