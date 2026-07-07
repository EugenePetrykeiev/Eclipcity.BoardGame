from html import escape


WELCOME_SUBJECT = "Welcome to Eclipcity"


def render_welcome_email(username: str) -> tuple[str, str]:
    safe_username = escape(username)

    text = (
        f"Вітаю, {username}! Ти приєднався до гри Eclipcity.\n\n"
        "Твою команду буде підготовлено до втечі з міста. "
        "Попереду кімнати, лобі, тунель і перший хід."
    )

    html = f"""
<!doctype html>
<html lang="uk">
  <body style="margin:0;background:#0A0E14;color:#E6EAF0;font-family:'Space Mono', monospace;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0A0E14;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#141A24;border:1px solid #1E2530;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="padding:28px 28px 18px;border-bottom:1px solid #1E2530;">
                <div style="font-size:12px;letter-spacing:1px;color:#FF2E9A;text-transform:uppercase;">Access confirmed</div>
                <h1 style="margin:12px 0 0;color:#E6EAF0;font-family:Arial, sans-serif;font-size:32px;line-height:1.2;">Eclipcity</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <p style="margin:0 0 18px;font-size:18px;line-height:1.6;color:#E6EAF0;">Вітаю, <strong style="color:#B6FF00;">{safe_username}</strong>!</p>
                <p style="margin:0 0 18px;font-size:15px;line-height:1.75;color:#E6EAF0;">
                  Ти приєднався до гри <strong>Eclipcity</strong>. Твою команду буде підготовлено до втечі з міста 2150 року.
                </p>
                <p style="margin:0;font-size:15px;line-height:1.75;color:#8A96A6;">
                  Попереду кімнати, лобі, тунель, карти предметів і перший ризикований хід. Система вже знає твоє ім'я.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px 28px;">
                <div style="border:1px solid rgba(182,255,0,0.36);background:rgba(182,255,0,0.08);border-radius:6px;padding:14px;color:#B6FF00;font-size:13px;line-height:1.6;">
                  Status: runner profile initialized.
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
""".strip()

    return text, html
