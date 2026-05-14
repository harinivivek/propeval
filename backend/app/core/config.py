from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def _resolved_env_files() -> tuple[str, ...] | None:
    """Paths to try for .env (independent of process cwd — fixes Celery/workers).

    Later entries override earlier ones. Typical layout: repo `.env.local`, then
    `backend/.env` for keys like ANTHROPIC_API_KEY / OPENROUTER_API_KEY.
    """
    here = Path(__file__).resolve()
    backend_dir = here.parents[2]  # .../backend/app/core/config.py -> backend/
    repo_dir = backend_dir.parent
    ordered = (
        repo_dir / ".env.local",
        repo_dir / ".env",
        backend_dir / ".env.local",
        backend_dir / ".env",
    )
    found = tuple(str(p) for p in ordered if p.is_file())
    return found if found else None


def _settings_config() -> SettingsConfigDict:
    kw: dict = {"env_file_encoding": "utf-8", "extra": "ignore"}
    files = _resolved_env_files()
    if files:
        kw["env_file"] = files
    return SettingsConfigDict(**kw)


class Settings(BaseSettings):
    # App
    APP_NAME: str = "PropEval"
    APP_ENV: str = "local"
    DEBUG: bool = True

    # Database
    POSTGRES_USER: str = "propeval"
    POSTGRES_PASSWORD: str = "propeval"
    POSTGRES_DB: str = "propeval"
    POSTGRES_HOST: str = "postgres"
    POSTGRES_PORT: int = 5432

    @property
    def DATABASE_URL(self) -> str:
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    @property
    def SYNC_DATABASE_URL(self) -> str:
        return (
            f"postgresql+psycopg2://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    # Redis
    REDIS_HOST: str = "redis"
    REDIS_PORT: int = 6379
    REDIS_URL: str = "redis://redis:6379/0"

    # JWT
    JWT_SECRET_KEY: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # JWT VAPID (Web Push)
    VAPID_PRIVATE_KEY: str = ""
    VAPID_PUBLIC_KEY: str = ""
    VAPID_SUBJECT: str = "mailto:admin@getitright.com"

    # OTP
    OTP_EXPIRE_MINUTES: int = 5
    DEV_OTP: str = "123456"

    # Celery
    CELERY_BROKER_URL: str = "redis://redis:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://redis:6379/2"

    # CORS — include loopback variants; LAN regex added in main.py for local DEBUG
    CORS_ORIGINS: str = (
        "http://localhost:3020,http://127.0.0.1:3020,http://[::1]:3020,"
        "https://propeval-dev.getitright.co.in"
    )

    # Media
    MEDIA_ROOT: str = "/app/media"
    MAX_UPLOAD_SIZE_MB: int = 50

    # Broadcasting
    VENDORS_PER_BROADCAST_ROUND: int = 5
    BROADCAST_ACCEPT_WINDOW_MINUTES: int = 30

    # Auto-accept
    AUTO_ACCEPT_DAYS: int = 7

    # OCR — OpenRouter is preferred when OPENROUTER_API_KEY is set (see ocr_tasks).
    ANTHROPIC_API_KEY: str = ""
    OPENROUTER_API_KEY: str = ""
    # OpenRouter model id — must be multimodal (PDF pages are sent as images). The slug
    # "openrouter/free" is not valid; use e.g. openai/gpt-4o-mini or a :free vision model from
    # OpenRouter's model list (e.g. google/gemini-2.0-flash-001).
    OCR_MODEL: str = "openai/gpt-4o-mini"
    # Required by OpenRouter; set to your public app URL in production.
    OPENROUTER_HTTP_REFERER: str = "http://localhost:8020"
    OCR_MAX_PAGES: int = 20
    OCR_BATCH_SIZE: int = 5
    OCR_TASK_TIMEOUT: int = 300

    model_config = _settings_config()

    @field_validator(
        "ANTHROPIC_API_KEY",
        "OPENROUTER_API_KEY",
        "OPENROUTER_HTTP_REFERER",
        mode="before",
    )
    @classmethod
    def strip_secret_env(cls, v: object) -> str:
        if v is None:
            return ""
        if isinstance(v, str):
            return v.strip()
        return str(v)


settings = Settings()
