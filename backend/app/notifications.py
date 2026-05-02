from datetime import datetime, timezone
import asyncio
import smtplib
from email.message import EmailMessage

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from .dependencies import get_current_user
from .database import get_database
from .config import settings

router = APIRouter()


# ── helper called by other modules ────────────────────────────────────────────

async def notify_user(user_id: str, message: str, notif_type: str = "info"):
    """Insert a notification document for user_id."""
    db = get_database()
    await db.notifications.insert_one(
        {
            "user_id": user_id,
            "message": message,
            "type": notif_type,
            "read": False,
            "created_at": datetime.now(timezone.utc),
        }
    )


async def notify_users(user_ids: list[str], message: str, notif_type: str = "info"):
    """Batch notify multiple users."""
    for uid in user_ids:
        await notify_user(uid, message, notif_type)


def email_notifications_enabled() -> bool:
    return bool(
        settings.SMTP_HOST
        and settings.SMTP_USERNAME
        and settings.SMTP_PASSWORD
        and settings.SMTP_FROM_EMAIL
    )


def _send_email_sync(to_email: str, subject: str, body: str):
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM_EMAIL
    msg["To"] = to_email
    msg.set_content(body)

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
        if settings.SMTP_USE_TLS:
            server.starttls()
        server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
        server.send_message(msg)


async def send_email_notification(to_email: str, subject: str, body: str) -> bool:
    if not email_notifications_enabled() or not to_email:
        return False
    try:
        await asyncio.to_thread(_send_email_sync, to_email, subject, body)
        return True
    except Exception:
        return False


# ── endpoints ────────────────────────────────────────────────────────────────

def _fmt(n: dict) -> dict:
    n["id"] = str(n["_id"])
    del n["_id"]
    return n


@router.get("")
async def list_notifications(
    unread_only: bool = False,
    current_user: dict = Depends(get_current_user),
):
    db = get_database()
    query: dict = {"user_id": str(current_user["_id"])}
    if unread_only:
        query["read"] = False
    notifs = await db.notifications.find(query).sort("created_at", -1).to_list(100)
    return [_fmt(n) for n in notifs]


@router.patch("/{notif_id}/read")
async def mark_read(notif_id: str, current_user: dict = Depends(get_current_user)):
    db = get_database()
    result = await db.notifications.update_one(
        {"_id": ObjectId(notif_id), "user_id": str(current_user["_id"])},
        {"$set": {"read": True}},
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Notification not found")
    return {"ok": True}


@router.patch("/read-all")
async def mark_all_read(current_user: dict = Depends(get_current_user)):
    db = get_database()
    await db.notifications.update_many(
        {"user_id": str(current_user["_id"]), "read": False},
        {"$set": {"read": True}},
    )
    return {"ok": True}
