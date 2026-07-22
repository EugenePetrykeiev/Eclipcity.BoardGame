# Eclipcity CI/CD

Цей каталог є джерелом deployment-конфігурації для `dev`. GitHub технічно
завантажує workflow лише з `.github/workflows`, тому там лежать два короткі
entrypoint-файли, а scripts і deployment Compose зберігаються тут.

## Автоматичний pipeline

Pull request запускає `.github/workflows/ci.yml`:

1. frontend: reproducible `npm ci`, unit tests, production build;
2. backend: Python 3.13 environment, dependencies, unit tests.

Push у `main`, який змінює application/container/CI файли, запускає
`.github/workflows/deploy-dev.yml` без ручного підтвердження:

1. повторює CI checks;
2. через GitHub OIDC приймає короткоживучу AWS build role;
3. збирає `linux/arm64` images `backend`, `frontend`, `nginx` і `deploy`;
4. публікує images в окремі ECR repositories з унікальним immutable tag;
5. передає до deployment jobs точні `repository@sha256:...` URI;
6. окремою backend role викликає backend SSM document;
7. backend EC2 отримує secret безпосередньо з Secrets Manager, запускає Alembic
   і лише після успішної міграції оновлює backend;
8. після здорового backend окремою frontend role оновлює frontend та nginx;
9. перевіряє public `/healthz` і проксований `/api/ready`.

`deploy` image містить versioned Compose-файли та host scripts. Тому зміна в
`cicd/` доставляється разом із release і не потребує окремого Terraform apply.

Кожен application EC2 самостійно завантажує image з ECR. GitHub runner не має
SSH-доступу до серверів; порт 22 лишається закритим. Backend і frontend deploy
roles не взаємозамінні: кожна може викликати тільки свій SSM document на своєму
instance.

## Одноразовий bootstrap

До першого автодеплою потрібен один ручний infrastructure apply. Він створює:

- чотири ECR repositories;
- GitHub OIDC provider;
- build, backend-deploy і frontend-deploy IAM roles;
- два SSM documents і два Parameter Store pointers на поточні instance IDs;
- private DNS record backend, який використовує nginx.

```bash
export TF_VAR_budget_alert_email="you@example.com"
terraform -chdir=infrastructure-tf/dev init -backend-config=backend.hcl
terraform -chdir=infrastructure-tf/dev plan -out=dev.tfplan
terraform -chdir=infrastructure-tf/dev show dev.tfplan
terraform -chdir=infrastructure-tf/dev apply dev.tfplan
./infrastructure-tf/dev/dns/sync-records.sh apply
```

У GitHub repository створіть Environment `dev`:

- без required reviewers, щоб dev запускався автоматично;
- deployment branches: тільки `main`;
- environment secrets не потрібні.

AWS access keys у GitHub Secrets додавати не треба. Trust policy приймає лише
OIDC subject `repo:EugenePetrykeiev/Eclipcity:environment:dev`.

Default відповідає classic OIDC subject repository, історія якого починається до
переходу GitHub на immutable subjects. Якщо в GitHub OIDC settings уже ввімкнено
immutable subject або ви ввімкнете його згодом, спочатку задайте точний новий
рядок через Terraform variable `github_oidc_subject_override`, застосуйте IAM
trust policy, і лише потім перемикайте GitHub setting — інакше deploy втратить
право приймати AWS role.

## Backend secret contract

Backend deployment ніколи не друкує secret. Він читає
`eclipcity/dev/backend` на EC2 та формує root-only runtime env file. До deployment
допускається тільки secret, у якому є DB, session, Google OAuth і SMTP/SES values.
Ці значення мають точно відповідати dev origin:

```text
FRONTEND_BASE_URL=https://dev.eclipcity.digitee.space
BACKEND_PUBLIC_URL=https://dev.eclipcity.digitee.space/api
CORS_ORIGINS=https://dev.eclipcity.digitee.space
GOOGLE_REDIRECT_URI=https://dev.eclipcity.digitee.space/api/auth/google/callback
SESSION_COOKIE_SECURE=true
SMTP_USE_TLS=true
```

Локальні OAuth URLs залишаються окремо у `.env.docker` і в Google Authorized
redirect URIs; pipeline їх не змінює.

## Rollback і міграції

Frontend/nginx автоматично повертаються до попередніх digest URI, якщо нові
контейнери не проходять health checks. Backend автоматично не відкочується після
Alembic: schema migration вже могла змінити БД. Backend migrations мають бути
backward-compatible; для проблемного release слід виправити migration/code і
запустити новий immutable release.

## TLS

Початковий smoke test використовує HTTP, а security group уже відкриває 80 і
443. Після синхронізації DNS треба окремо виконати Certbot bootstrap та додати
renewal timer/mount сертифіката до frontend Compose. До цього моменту pipeline не
вдає, що HTTPS уже готовий: production URLs у backend secret перевіряються, але
OAuth/login треба тестувати тільки після завершення TLS bootstrap.

## Ручний повторний запуск

`Deploy dev` можна повторити через `workflow_dispatch`. Кожен run отримує новий
immutable release ID, тому rerun не конфліктує з ECR tag immutability. Одночасні
dev deployments серіалізуються через concurrency group і не скасовують release,
який уже міг запустити migration.
