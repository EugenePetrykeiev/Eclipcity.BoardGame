# Eclipcity containers

## Local stack

The local stack contains five services:

1. `database` — an isolated PostgreSQL 16 instance for local development only.
2. `migration` — a one-shot Alembic migration runner.
3. `backend` — the FastAPI application, available only inside the Docker network.
4. `frontend` — the Vite build served by a minimal non-root static server inside
   the Docker network.
5. `nginx` — the only public entry point; it proxies the frontend and `/api/*`.

The browser uses one origin. Nginx proxies regular routes to `frontend` and
`/api/*` to `backend`, stripping the `/api` prefix before forwarding API
requests. Nginx has its own Dockerfile and is not part of the frontend image.

Create the ignored local environment file:

```bash
cp .env.docker.example .env.docker
openssl rand -hex 32
```

Put the generated value into `SESSION_SECRET_KEY` and replace the local database
password. Add Google and SMTP credentials only if those integrations need to be
tested locally.

Build and start everything:

```bash
docker compose --env-file .env.docker up --build
```

Open [http://localhost](http://localhost). Useful checks:

```bash
docker compose --env-file .env.docker ps
curl http://localhost/healthz
curl http://localhost/api/health
curl http://localhost/api/ready
```

Stop containers without deleting the local database:

```bash
docker compose --env-file .env.docker down
```

`docker compose down --volumes` also deletes the local PostgreSQL data and should
only be used when a clean local database is intended.

## OAuth URLs

Keep both redirect URIs in the same Google OAuth client if the same client is
used for local and production environments:

```text
http://localhost/api/auth/google/callback
https://eclipcity.digitee.space/api/auth/google/callback
```

The local Compose values derive the callback from:

```text
BACKEND_PUBLIC_URL=http://localhost/api
```

## Nginx HTTP/TLS template

`docker/nginx.conf.template` is rendered by the Nginx container at startup. The
local Compose publishes host port `80` to the unprivileged container port `8080`.
The Nginx container is independent from the frontend image.

For the future AWS frontend EC2, the same template supports HTTPS by setting:

```yaml
environment:
  NGINX_HTTP_PORT: "8080"
  NGINX_HTTPS_LISTEN: "listen 8443 ssl;"
  NGINX_HTTP2_DIRECTIVE: "http2 on;"
  NGINX_SERVER_NAME: eclipcity.digitee.space
  NGINX_SSL_CERTIFICATE: "ssl_certificate /etc/letsencrypt/live/eclipcity.digitee.space/fullchain.pem;"
  NGINX_SSL_CERTIFICATE_KEY: "ssl_certificate_key /etc/letsencrypt/live/eclipcity.digitee.space/privkey.pem;"
  NGINX_HTTP_REDIRECT: "if ($$scheme = http) { return 308 https://$$host$$request_uri; }"
ports:
  - "80:8080"
  - "443:8443"
volumes:
  - /etc/letsencrypt:/etc/letsencrypt:ro
```

The doubled dollar signs are required in Compose YAML so Nginx receives its own
`$scheme`, `$host`, and `$request_uri` variables. Certificate bootstrapping and
renewal hooks will be added with the AWS deployment configuration; TLS variables
must not be enabled before Certbot has created the referenced certificate files.

Production must use:

```text
FRONTEND_BASE_URL=https://eclipcity.digitee.space
BACKEND_PUBLIC_URL=https://eclipcity.digitee.space/api
GOOGLE_REDIRECT_URI=https://eclipcity.digitee.space/api/auth/google/callback
CORS_ORIGINS=https://eclipcity.digitee.space
SESSION_COOKIE_SECURE=true
```

## AWS Secrets Manager preparation

Create a dedicated secret such as `eclipcity/prod/backend`. Do not reuse a
GitHub Actions secret to transport application credentials. The backend EC2
instance should fetch the secret at deployment time through its IAM instance
role.

Store a JSON object with these keys:

```json
{
  "POSTGRES_HOST": "private-dns-or-private-ip-of-database-ec2",
  "POSTGRES_PORT": "5432",
  "POSTGRES_DB": "eclipcity",
  "POSTGRES_USER": "replace-me",
  "POSTGRES_PASSWORD": "replace-me",
  "FRONTEND_BASE_URL": "https://eclipcity.digitee.space",
  "BACKEND_PUBLIC_URL": "https://eclipcity.digitee.space/api",
  "POST_AUTH_REDIRECT_PATH": "/",
  "CORS_ORIGINS": "https://eclipcity.digitee.space",
  "SESSION_SECRET_KEY": "replace-with-at-least-32-random-characters",
  "SESSION_COOKIE_NAME": "eclipcity_session",
  "SESSION_COOKIE_MAX_AGE": "1209600",
  "SESSION_COOKIE_SECURE": "true",
  "GOOGLE_CLIENT_ID": "replace-me",
  "GOOGLE_CLIENT_SECRET": "replace-me",
  "GOOGLE_REDIRECT_URI": "https://eclipcity.digitee.space/api/auth/google/callback",
  "SMTP_HOST": "email-smtp.eu-central-1.amazonaws.com",
  "SMTP_PORT": "587",
  "SMTP_USERNAME": "replace-me",
  "SMTP_PASSWORD": "replace-me",
  "SMTP_FROM_EMAIL": "no-reply@eclipcity.digitee.space",
  "SMTP_FROM_NAME": "Eclipcity",
  "SMTP_USE_TLS": "true"
}
```

Use the AWS console to enter the values so credentials do not end up in shell
history. For SES SMTP, verify the sender identity and create SMTP credentials in
the same AWS Region. SES SMTP credentials are different from ordinary AWS access
keys.

Attach an instance profile to the backend EC2 with only:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "secretsmanager:GetSecretValue",
      "Resource": "arn:aws:secretsmanager:eu-central-1:ACCOUNT_ID:secret:eclipcity/prod/backend-*"
    }
  ]
}
```

If the secret uses a customer-managed KMS key, also grant `kms:Decrypt` for that
specific key. Do not grant wildcard access to all secrets.

At deployment time, use the included validation script to fetch the secret on the
backend EC2 and atomically render a root-owned environment file. The future
deployment configuration should read this file with Compose `env_file`; it must
never be copied into an image:

```bash
sudo AWS_REGION=eu-central-1 \
  SECRET_ID=eclipcity/prod/backend \
  ./scripts/fetch-backend-secret.sh
```

The script validates the required database, session, Google, and SMTP values
before replacing `/opt/eclipcity/env/backend.env`. A failed fetch or validation
leaves the previous environment file untouched.

The frontend image has no runtime secrets. `VITE_API_BASE_URL=/api` is a public
build-time value, not a credential.

## Existing production database and Alembic

The initial revision is `20260717_0001`. It creates a fresh database, so do not
run `alembic upgrade head` directly against the existing EC2 database if it
already contains Eclipcity tables.

Before adopting Alembic on that database:

1. Take an EBS snapshot and a logical `pg_dump` backup.
2. Export the schema with `pg_dump --schema-only`.
3. Verify that all current model tables, columns, constraints, and types match
   `20260717_0001`.
4. Run `alembic stamp 20260717_0001` once to record the baseline without changing
   tables.
5. Run `alembic current` and confirm that it reports `20260717_0001 (head)`.
6. From then on, run `alembic upgrade head` as a separate one-shot service before
   starting a new backend release.

Do not stamp a schema with missing columns. If the comparison finds drift, create
a reviewed reconciliation migration first.

## Production network boundary

The future frontend EC2 will be the only public application host. Certbot will
manage the certificate there, and Nginx will proxy `/api/*` to the backend EC2
over the VPC private network. Backend port `8000` should accept traffic only from
the frontend security group. PostgreSQL port `5432` should accept traffic only
from the backend security group. Neither backend nor PostgreSQL should expose an
internet-wide ingress rule.
