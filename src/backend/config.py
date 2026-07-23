from functools import lru_cache
from typing import Annotated, Literal
from urllib.parse import quote_plus

from pydantic import AnyUrl, BeforeValidator, Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def normalize_postgres_url(value: str | None) -> str | None:
    if value is None:
        return None
    if value.startswith("postgresql://"):
        return value.replace("postgresql://", "postgresql+asyncpg://", 1)
    return value


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: Annotated[str | None, BeforeValidator(normalize_postgres_url)] = None
    postgres_host: str | None = None
    postgres_port: int = 5432
    postgres_db: str | None = None
    postgres_user: str | None = None
    postgres_password: str | None = None
    postgres_ssl_mode: Literal[
        "disable",
        "allow",
        "prefer",
        "require",
        "verify-ca",
        "verify-full",
    ] = "disable"

    frontend_base_url: AnyUrl
    backend_public_url: AnyUrl | None = None
    post_auth_redirect_path: str = "/"
    cors_origins: str = ""

    session_secret_key: str = Field(min_length=32)
    session_cookie_name: str = "eclipcity_session"
    session_cookie_max_age: int = 60 * 60 * 24 * 14
    session_cookie_secure: bool = False

    google_client_id: str | None = None
    google_client_secret: str | None = None
    google_redirect_uri: str | None = None

    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_from_email: str | None = None
    smtp_from_name: str = "Eclipcity"
    smtp_use_tls: bool = True

    @model_validator(mode="after")
    def build_database_url(self) -> "Settings":
        if self.database_url:
            return self

        required_parts = [
            self.postgres_host,
            self.postgres_db,
            self.postgres_user,
            self.postgres_password,
        ]
        if not all(required_parts):
            raise ValueError(
                "Set DATABASE_URL or all POSTGRES_HOST, POSTGRES_DB, "
                "POSTGRES_USER, and POSTGRES_PASSWORD values."
            )

        user = quote_plus(self.postgres_user or "")
        password = quote_plus(self.postgres_password or "")
        host = self.postgres_host
        db_name = quote_plus(self.postgres_db or "")
        ssl_mode = quote_plus(self.postgres_ssl_mode)
        self.database_url = (
            f"postgresql+asyncpg://{user}:{password}"
            f"@{host}:{self.postgres_port}/{db_name}?ssl={ssl_mode}"
        )
        return self

    def allowed_origins(self) -> list[str]:
        origins = {str(self.frontend_base_url).rstrip("/")}
        origins.update(
            origin.strip().rstrip("/")
            for origin in self.cors_origins.split(",")
            if origin.strip()
        )
        return sorted(origins)

    def frontend_redirect_url(self) -> str:
        base = str(self.frontend_base_url).rstrip("/")
        path = self.post_auth_redirect_path
        if not path.startswith("/"):
            path = f"/{path}"
        return f"{base}{path}"

    def oauth_configured(self) -> bool:
        return bool(self.google_client_id and self.google_client_secret)

    def smtp_configured(self) -> bool:
        return bool(self.smtp_host and self.smtp_from_email)


@lru_cache
def get_settings() -> Settings:
    return Settings()
