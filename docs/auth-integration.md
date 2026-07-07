# Eclipcity Auth Integration Notes

This document describes the current home-page authentication behavior and the next backend integration steps.

## Current Preview Behavior

The home page currently supports:

1. Login and Register modes.
2. Client-side validation for email, username, password, and password confirmation.
3. Loading and success/error states.
4. A Google OAuth button wired as a preview stub.
5. Local preview session persistence in `localStorage` under `eclipcity.preview.auth`.

No real user account is created yet. The implementation is intentionally isolated in:

`src/services/authClient.js`

## Backend Integration Target

When the FastAPI backend is added, replace the preview service with real API calls:

1. `POST /auth/register`
2. `POST /auth/login`
3. `GET /auth/google/start`
4. `GET /auth/google/callback`
5. `POST /auth/logout`
6. `GET /auth/me`

The frontend should receive either an HTTP-only session cookie or a short-lived access token plus refresh flow. For browser security, an HTTP-only cookie is preferred.

## Expected Responses

Successful email login/register:

```json
{
  "user": {
    "id": "user-id",
    "username": "runner_2150",
    "email": "runner@example.com"
  },
  "next": "/game"
}
```

Validation or auth failure:

```json
{
  "code": "INVALID_CREDENTIALS",
  "message": "Email or password is incorrect."
}
```

## Redirect After Auth

After successful real authentication, the home page should navigate to the authenticated game area. The product requirements currently define that next screen as the start-game area with room selection.

Recommended future route:

`/game`
