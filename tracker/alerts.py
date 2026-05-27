import logging
import os
import smtplib
from email.message import EmailMessage

log = logging.getLogger(__name__)

_REQUIRED_ENV = ("SMTP_SENDER", "SMTP_PASSWORD", "SMTP_RECIPIENT")


def _email_creds():
    missing = [k for k in _REQUIRED_ENV if not os.environ.get(k)]
    if missing:
        raise EnvironmentError(
            f"Missing required env var(s): {', '.join(missing)}. See .env.example."
        )
    return (
        os.environ["SMTP_SENDER"],
        os.environ["SMTP_PASSWORD"],
        os.environ["SMTP_RECIPIENT"],
    )


def send_alert(route, new_price, old_price):
    """Send an email when a price drops below the route threshold."""
    sender, password, recipient = _email_creds()
    smtp_host = os.environ.get("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.environ.get("SMTP_PORT", "587"))

    ret_line = f"Return:     {route['return_date']}\n" if route.get("return_date") else ""

    msg = EmailMessage()
    msg["Subject"] = (
        f"Price Drop: {route['origin']} → {route['destination']} "
        f"now ₹{new_price:,.0f}"
    )
    msg["From"] = sender
    msg["To"] = recipient
    msg.set_content(
        f"Price drop detected!\n\n"
        f"Route:      {route['origin']} → {route['destination']} ({route['trip_type']})\n"
        f"Depart:     {route['depart_date']}\n"
        f"{ret_line}"
        f"\n"
        f"New price:  ₹{new_price:,.0f}\n"
        f"Was:        ₹{old_price:,.0f}\n"
        f"Threshold:  ₹{route['threshold']:,.0f}\n"
        f"\nHappy booking!\n"
    )

    try:
        with smtplib.SMTP(smtp_host, smtp_port) as smtp:
            smtp.starttls()
            smtp.login(sender, password)
            smtp.send_message(msg)
        log.info("Alert sent to %s", recipient)
    except smtplib.SMTPException as exc:
        log.error("Failed to send alert email: %s", exc)
        raise
