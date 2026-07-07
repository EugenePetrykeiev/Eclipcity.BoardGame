from urllib.parse import urlencode

import httpx
from fastapi import HTTPException, Request, status

from .config import Settings


GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo"


def callback_url(request: Request, settings: Settings) -> str:
    if settings.google_redirect_uri:
        return settings.google_redirect_uri

    if settings.backend_public_url:
        return f"{str(settings.backend_public_url).rstrip('/')}/auth/google/callback"

    return str(request.url_for("google_callback"))


def authorization_url(
    request: Request,
    settings: Settings,
    state: str,
) -> str:
    if not settings.oauth_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google OAuth is not configured.",
        )

    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": callback_url(request, settings),
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "prompt": "select_account",
    }
    return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"


async def exchange_google_code(
    request: Request,
    settings: Settings,
    code: str,
) -> dict:
    if not settings.oauth_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google OAuth is not configured.",
        )

    async with httpx.AsyncClient(timeout=10) as client:
        token_response = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uri": callback_url(request, settings),
                "grant_type": "authorization_code",
            },
        )

        if token_response.status_code >= 400:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Google OAuth token exchange failed.",
            )

        token_payload = token_response.json()
        id_token = token_payload.get("id_token")
        if not id_token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Google OAuth response did not include an ID token.",
            )

        profile_response = await client.get(
            GOOGLE_TOKENINFO_URL,
            params={"id_token": id_token},
        )

        if profile_response.status_code >= 400:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Google OAuth profile verification failed.",
            )

    profile = profile_response.json()
    if profile.get("aud") != settings.google_client_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google OAuth audience mismatch.",
        )

    if not profile.get("sub") or not profile.get("email"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google OAuth profile is missing required fields.",
        )

    return profile
