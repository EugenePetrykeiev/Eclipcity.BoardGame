from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import User
from .security import hash_password, verify_password


def normalize_email(email: str) -> str:
    return email.strip().lower()


def username_from_email(email: str) -> str:
    base = email.split("@", 1)[0]
    cleaned = "".join(char for char in base if char.isalnum() or char in "_-")
    return (cleaned or "runner")[:24]


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == normalize_email(email)))
    return result.scalar_one_or_none()


async def get_user_by_id(db: AsyncSession, user_id) -> User | None:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def get_user_by_google_sub(db: AsyncSession, google_sub: str) -> User | None:
    result = await db.execute(select(User).where(User.google_sub == google_sub))
    return result.scalar_one_or_none()


async def username_exists(db: AsyncSession, username: str) -> bool:
    result = await db.execute(select(User.id).where(User.username == username))
    return result.scalar_one_or_none() is not None


async def make_unique_username(db: AsyncSession, seed: str) -> str:
    candidate = seed[:24]
    if not await username_exists(db, candidate):
        return candidate

    suffix = 2
    while True:
        tail = f"_{suffix}"
        candidate = f"{seed[: 24 - len(tail)]}{tail}"
        if not await username_exists(db, candidate):
            return candidate
        suffix += 1


async def create_password_user(
    db: AsyncSession,
    username: str,
    email: str,
    password: str,
) -> User:
    user = User(
        username=username.strip(),
        email=normalize_email(email),
        password_hash=hash_password(password),
        email_verified=False,
    )
    db.add(user)
    await db.flush()
    return user


async def authenticate_password_user(
    db: AsyncSession,
    email: str,
    password: str,
) -> User | None:
    user = await get_user_by_email(db, email)
    if not user or not verify_password(password, user.password_hash):
        return None
    return user


async def upsert_google_user(
    db: AsyncSession,
    google_sub: str,
    email: str,
    email_verified: bool,
    name: str | None,
    picture: str | None,
) -> tuple[User, bool]:
    user = await get_user_by_google_sub(db, google_sub)
    if user:
        user.email_verified = email_verified
        user.avatar_url = picture
        await db.flush()
        return user, False

    user = await get_user_by_email(db, email)
    if user:
        user.google_sub = google_sub
        user.email_verified = user.email_verified or email_verified
        user.avatar_url = picture
        await db.flush()
        return user, False

    seed = username_from_email(email)
    username = await make_unique_username(db, seed[:24])
    user = User(
        username=username,
        email=normalize_email(email),
        email_verified=email_verified,
        google_sub=google_sub,
        avatar_url=picture,
    )
    db.add(user)
    await db.flush()
    return user, True
