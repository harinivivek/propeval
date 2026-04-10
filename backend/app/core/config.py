from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # App
    APP_NAME: str = "PropEval"
    APP_ENV: str = "local"
    DEBUG: bool = True

    # Database
    POSTGRES_USER: str = "propeval"
    POSTGRES_PASSWORD: str = "propeval"
    POSTGRES_DB: str = "propeval"
    POSTGRES_HOST: str = "localhost"
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
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_URL: str = "redis://localhost:6379/0"

    # JWT
    JWT_SECRET_KEY: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # OTP
    OTP_EXPIRE_MINUTES: int = 5
    DEV_OTP: str = "123456"

    # Celery
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"

    # CORS
    CORS_ORIGINS: str = "http://localhost:3000"

    # Media
    MEDIA_ROOT: str = "/app/media"
    MAX_UPLOAD_SIZE_MB: int = 50

    # Broadcasting
    VENDORS_PER_BROADCAST_ROUND: int = 5
    BROADCAST_ACCEPT_WINDOW_MINUTES: int = 30

    # Auto-accept
    AUTO_ACCEPT_DAYS: int = 7

    # OCR
    ANTHROPIC_API_KEY: str = ""
    OCR_MODEL: str = "claude-sonnet-4-6"
    OCR_MAX_PAGES: int = 20
    OCR_BATCH_SIZE: int = 5
    OCR_TASK_TIMEOUT: int = 300

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
