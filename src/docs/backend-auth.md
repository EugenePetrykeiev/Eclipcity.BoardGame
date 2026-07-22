# Eclipcity Backend Auth Notes

Backend code lives in `src/backend`.

## What Is Implemented

1. Traditional email/password registration and login.
2. Server-side Google OAuth redirect flow.
3. PostgreSQL persistence through SQLAlchemy async sessions.
4. HTTP-only signed session cookie.
5. Welcome email after a new user joins Eclipcity.
6. Email delivery records in the database.

## Local Backend Setup

Create and fill an env file:

```bash
cp src/backend/.env.example .env
```

Install Python dependencies:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r src/backend/requirements.txt
```

Start FastAPI:

```bash
uvicorn src.backend.main:app --reload --host localhost --port 8000
```

For the frontend, set:

```bash
VITE_API_BASE_URL=http://localhost:8000
```

Reference file:

```text
src/frontend.env.example
```

For Vite local development, copy that value into a project-root `.env.local`.

Do not commit real `.env` values.

## Database

Use PostgreSQL. The backend expects:

```text
DATABASE_URL=postgresql+asyncpg://USER:PASSWORD@HOST:5432/eclipcity
```

Alternatively, use separate values. This format maps well to AWS Secrets Manager fields:

```text
POSTGRES_HOST=your-db-host.amazonaws.com
POSTGRES_PORT=5432
POSTGRES_DB=eclipcity
POSTGRES_USER=eclipcity_user
POSTGRES_PASSWORD=your-password
```

If both formats are present, `DATABASE_URL` wins.

Schema changes are managed only through Alembic. Apply pending migrations before
starting the backend:

```bash
alembic upgrade head
```

The backend startup path does not create or alter tables. The local Docker stack
runs Alembic through its one-shot `migration` service.

Created tables:

1. `users`
2. `email_deliveries`

## Auth Endpoints

`POST /auth/register`

```json
{
  "username": "runner_2150",
  "email": "runner@example.com",
  "password": "secret2150"
}
```

Successful response includes the welcome email status:

```json
{
  "user": {
    "id": "user-id",
    "username": "runner_2150",
    "email": "runner@example.com",
    "email_verified": false,
    "avatar_url": null,
    "created_at": "2026-07-07T19:45:00Z"
  },
  "next": "/user/user-id",
  "message": "Профіль створено. Ласкаво просимо до Eclipcity.",
  "email_delivery_status": "sent"
}
```

`POST /auth/login`

```json
{
  "email": "runner@example.com",
  "password": "secret2150"
}
```

`GET /auth/google/start`

Redirects the user to Google.

`GET /auth/google/callback`

Google returns the user here after consent.

`GET /auth/me`

Returns the current user from the signed session cookie.

`GET /users/{user_id}`

Returns the current user's profile for the `/user/{uuid}` page. The backend returns `403` if the requested UUID does not match the authenticated session user.

`POST /auth/logout`

Clears the session cookie.

## Google OAuth Console Values

This implementation uses a server-side OAuth redirect flow. That means Google needs an Authorized redirect URI.

Local development redirect URI:

```text
http://localhost:8000/auth/google/callback
```

For the single-origin production deployment, set:

```text
BACKEND_PUBLIC_URL=https://eclipcity.digitee.space/api
```

Then add this Authorized redirect URI in Google Cloud:

```text
https://eclipcity.digitee.space/api/auth/google/callback
```

Authorized JavaScript origins are not required for this backend-driven flow. They are only needed if the frontend uses Google Identity Services directly in the browser. If that approach is chosen later, add the frontend origin, for example:

```text
http://localhost:5173
```

Without a real domain, use only local development URLs in Google Cloud. After deployment, add the real backend redirect URI and, if needed, the frontend JavaScript origin.

## OAuth Environment Variables

```text
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

Optional explicit redirect override:

```text
GOOGLE_REDIRECT_URI=http://localhost:8000/auth/google/callback
```

The Docker Compose redirect URI is:

```text
http://localhost/api/auth/google/callback
```

Prefer `BACKEND_PUBLIC_URL` unless a proxy or hosting provider requires an exact override.

## Session Settings

Use a long random secret:

```text
SESSION_SECRET_KEY=replace-with-at-least-32-random-characters
```

For HTTPS production:

```text
SESSION_COOKIE_SECURE=true
```

For local HTTP development:

```text
SESSION_COOKIE_SECURE=false
```

## Welcome Email

After a new user registers or joins through Google OAuth, the backend sends a welcome email.

The message says, in Ukrainian:

```text
Вітаю, "юзер"! Ти приєднався до гри Eclipcity.
```

The HTML design follows `context/cyberpunk-color-palette-spec.md`:

1. Void Black background.
2. Deep Slate panel.
3. Toxic Lime primary accent.
4. Neon Magenta status accent.
5. Ghost White readable text.

SMTP configuration:

```text
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USERNAME=...
SMTP_PASSWORD=...
SMTP_FROM_EMAIL=no-reply@eclipcity.digitee.space
SMTP_FROM_NAME=Eclipcity
SMTP_USE_TLS=true
```

If SMTP is not configured, the backend records the welcome email as `skipped` in `email_deliveries` and continues registration.

Delivery status values:

1. `sent` - SMTP accepted the message.
2. `failed` - SMTP sending raised an error; the error is stored in `provider_message`.
3. `skipped` - SMTP is not configured, so registration continued without sending.
