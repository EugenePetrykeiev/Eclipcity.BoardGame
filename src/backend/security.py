import uuid
from typing import Any

from passlib.context import CryptContext
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from .config import Settings


password_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return password_context.hash(password)


def verify_password(password: str, password_hash: str | None) -> bool:
    if not password_hash:
        return False
    return password_context.verify(password, password_hash)


def session_serializer(settings: Settings) -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(
        settings.session_secret_key,
        salt="eclipcity-session",
    )


def oauth_state_serializer(settings: Settings) -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(
        settings.session_secret_key,
        salt="eclipcity-oauth-state",
    )


def create_session_token(settings: Settings, user_id: uuid.UUID) -> str:
    return session_serializer(settings).dumps({"sub": str(user_id)})


def read_session_token(settings: Settings, token: str) -> uuid.UUID | None:
    try:
        payload: dict[str, Any] = session_serializer(settings).loads(
            token,
            max_age=settings.session_cookie_max_age,
        )
    except (BadSignature, SignatureExpired, ValueError):
        return None

    subject = payload.get("sub")
    if not subject:
        return None

    try:
        return uuid.UUID(subject)
    except ValueError:
        return None


def create_oauth_state(settings: Settings, mode: str) -> str:
    return oauth_state_serializer(settings).dumps({"mode": mode})


def read_oauth_state(settings: Settings, state: str) -> dict[str, str] | None:
    try:
        return oauth_state_serializer(settings).loads(state, max_age=600)
    except (BadSignature, SignatureExpired, ValueError):
        return None
