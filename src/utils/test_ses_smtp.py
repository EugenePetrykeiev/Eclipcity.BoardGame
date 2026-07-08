import os
import smtplib
from email.message import EmailMessage

smtp_host = os.environ["SMTP_HOST"]
smtp_port = int(os.environ["SMTP_PORT"])
smtp_username = os.environ["SMTP_USERNAME"]
smtp_password = os.environ["SMTP_PASSWORD"]

from_email = os.environ["SMTP_FROM_EMAIL"]
to_email = os.environ.get("TEST_TO_EMAIL", from_email)

msg = EmailMessage()
msg["Subject"] = "SES SMTP test"
msg["From"] = from_email
msg["To"] = to_email
msg.set_content("Hello from AWS SES SMTP test.")

with smtplib.SMTP(smtp_host, smtp_port) as server:
    server.set_debuglevel(0)
    server.ehlo()
    server.starttls()
    server.ehlo()
    server.login(smtp_username, smtp_password)
    server.send_message(msg)

print("Email sent")
