from email.message import EmailMessage

import aiosmtplib
from sqlalchemy.ext.asyncio import AsyncSession

from .config import Settings
from .email_templates import WELCOME_SUBJECT, render_welcome_email
from .models import EmailDelivery, User


async def record_email_delivery(
    db: AsyncSession,
    user: User,
    subject: str,
    status: str,
    provider_message: str | None = None,
) -> None:
    db.add(
        EmailDelivery(
            user_id=user.id,
            to_email=user.email,
            subject=subject,
            status=status,
            provider_message=provider_message,
        )
    )
    await db.flush()


async def send_welcome_email(
    db: AsyncSession,
    settings: Settings,
    user: User,
) -> None:
    if not settings.smtp_configured():
        await record_email_delivery(
            db,
            user,
            WELCOME_SUBJECT,
            "skipped",
            "SMTP is not configured.",
        )
        return

    text_body, html_body = render_welcome_email(user.username)
    message = EmailMessage()
    message["From"] = f"{settings.smtp_from_name} <{settings.smtp_from_email}>"
    message["To"] = user.email
    message["Subject"] = WELCOME_SUBJECT
    message.set_content(text_body)
    message.add_alternative(html_body, subtype="html")

    try:
        await aiosmtplib.send(
            message,
            hostname=settings.smtp_host,
            port=settings.smtp_port,
            username=settings.smtp_username,
            password=settings.smtp_password,
            start_tls=settings.smtp_use_tls,
        )
    except Exception as error:
        await record_email_delivery(
            db,
            user,
            WELCOME_SUBJECT,
            "failed",
            str(error),
        )
        return

    await record_email_delivery(db, user, WELCOME_SUBJECT, "sent")
