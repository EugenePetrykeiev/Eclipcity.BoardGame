from fastapi import Depends, FastAPI, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from .auth_repository import (
    authenticate_password_user,
    create_password_user,
    get_user_by_email,
    get_user_by_id,
    upsert_google_user,
)
from .config import Settings, get_settings
from .database import create_tables, get_db
from .email_service import send_welcome_email
from .google_oauth import authorization_url, exchange_google_code
from .schemas import AuthResponse, LoginRequest, RegisterRequest, UserResponse
from .security import (
    create_oauth_state,
    create_session_token,
    read_oauth_state,
    read_session_token,
)


settings = get_settings()
app = FastAPI(title="Eclipcity API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


@app.on_event("startup")
async def on_startup() -> None:
    if settings.auto_create_tables:
        await create_tables()


def set_session_cookie(response: Response, user_id) -> None:
    token = create_session_token(settings, user_id)
    response.set_cookie(
        key=settings.session_cookie_name,
        value=token,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite="lax",
        max_age=settings.session_cookie_max_age,
        path="/",
    )


async def current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    token = request.cookies.get(settings.session_cookie_name)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)

    user_id = read_session_token(settings, token)
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)

    user = await get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)

    return UserResponse.model_validate(user)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/auth/register", response_model=AuthResponse)
async def register(
    payload: RegisterRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> AuthResponse:
    if await get_user_by_email(db, payload.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email is already registered.",
        )

    try:
        user = await create_password_user(
            db,
            payload.username,
            payload.email,
            payload.password,
        )
        await send_welcome_email(db, settings, user)
        await db.commit()
    except IntegrityError as error:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username or email is already registered.",
        ) from error

    set_session_cookie(response, user.id)
    return AuthResponse(
        user=UserResponse.model_validate(user),
        next=settings.post_auth_redirect_path,
        message="Профіль створено. Ласкаво просимо до Eclipcity.",
    )


@app.post("/auth/login", response_model=AuthResponse)
async def login(
    payload: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> AuthResponse:
    user = await authenticate_password_user(db, payload.email, payload.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email or password is incorrect.",
        )

    set_session_cookie(response, user.id)
    return AuthResponse(
        user=UserResponse.model_validate(user),
        next=settings.post_auth_redirect_path,
        message="Вхід виконано. Сесію Eclipcity відкрито.",
    )


@app.get("/auth/me", response_model=UserResponse)
async def me(user: UserResponse = Depends(current_user)) -> UserResponse:
    return user


@app.post("/auth/logout")
async def logout(response: Response) -> dict[str, str]:
    response.delete_cookie(settings.session_cookie_name, path="/")
    return {"message": "Session closed."}


@app.get("/auth/google/start")
async def google_start(request: Request, mode: str = "login") -> RedirectResponse:
    state = create_oauth_state(settings, mode if mode == "register" else "login")
    return RedirectResponse(authorization_url(request, settings, state))


@app.get("/auth/google/callback", name="google_callback")
async def google_callback(
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    db: AsyncSession = Depends(get_db),
) -> RedirectResponse:
    if error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Google OAuth failed: {error}",
        )

    if not code or not state or not read_oauth_state(settings, state):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google OAuth state is invalid.",
        )

    profile = await exchange_google_code(request, settings, code)
    user, created = await upsert_google_user(
        db,
        google_sub=profile["sub"],
        email=profile["email"],
        email_verified=profile.get("email_verified") == "true",
        name=profile.get("name"),
        picture=profile.get("picture"),
    )

    if created:
        await send_welcome_email(db, settings, user)

    await db.commit()

    redirect = RedirectResponse(settings.frontend_redirect_url())
    set_session_cookie(redirect, user.id)
    return redirect
