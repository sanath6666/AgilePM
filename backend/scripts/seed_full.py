"""
Seed the database with a full demo dataset. All created_* times anchor to "now" (UTC);
sprint and task deadlines are relative to today's date so the dataset always feels fresh.

Usage (from backend/):
    python -m scripts.seed_full --reset

Requires MongoDB (same URI as .env). Loads SBERT once to fill bug embeddings (slow first run).

Login after seed (all accounts use the same password):
    Password: SeedDemo123!
    admin@seed.demo, manager@seed.demo, alice@seed.demo, bob@seed.demo, carol@seed.demo
"""
from __future__ import annotations

import argparse
import asyncio
import os
import sys
from datetime import date, datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from bson import ObjectId

from app.auth import _hash
from app.config import settings
from app.database import get_client, get_database


COLLECTIONS = ("notifications", "tasks", "bugs", "sprints", "projects", "users")

DEFAULT_PASSWORD = "SeedDemo123!"


def _embed_sync(text: str) -> list[float]:
    from app.ai_module import encode

    return encode(text)


async def _embed(text: str) -> list[float]:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _embed_sync, text)


async def reset_db(db) -> None:
    for name in COLLECTIONS:
        if name in await db.list_collection_names():
            await db[name].delete_many({})
    print("Cleared:", ", ".join(COLLECTIONS))


async def main() -> None:
    parser = argparse.ArgumentParser(description="Seed full demo data (date-aware).")
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Delete existing users/projects/tasks/bugs/sprints/notifications then seed.",
    )
    args = parser.parse_args()

    now = datetime.now(timezone.utc)
    today = date.today()

    # Future milestones (relative to today)
    d3 = (today + timedelta(days=3)).isoformat()
    d7 = (today + timedelta(days=7)).isoformat()
    d10 = (today + timedelta(days=10)).isoformat()
    d14 = (today + timedelta(days=14)).isoformat()
    d21 = (today + timedelta(days=21)).isoformat()
    sprint_end = (today + timedelta(days=14)).isoformat()
    sprint_next_start = (today + timedelta(days=15)).isoformat()
    sprint_next_end = (today + timedelta(days=28)).isoformat()

    # A couple of past deadlines so delay analytics / dashboard are interesting
    overdue_a = (today - timedelta(days=2)).isoformat()
    overdue_b = (today - timedelta(days=5)).isoformat()

    db = get_database()

    if not args.reset:
        if await db.users.count_documents({}) > 0:
            print("Database already has users. Re-run with --reset to wipe and reseed.")
            sys.exit(1)
    else:
        await reset_db(db)

    def stagger(minutes: int) -> datetime:
        return now - timedelta(minutes=minutes)

    # ── Users ───────────────────────────────────────────────────────────────
    users_spec = [
        ("Admin User", "admin@seed.demo", "admin"),
        ("Morgan Lee", "manager@seed.demo", "manager"),
        ("Alice Chen", "alice@seed.demo", "developer"),
        ("Bob Patel", "bob@seed.demo", "developer"),
        ("Carol Diaz", "carol@seed.demo", "tester"),
    ]
    user_ids: dict[str, str] = {}
    for i, (name, email, role) in enumerate(users_spec):
        ins = await db.users.insert_one(
            {
                "name": name,
                "email": email,
                "hashed_password": _hash(DEFAULT_PASSWORD),
                "role": role,
                "created_at": stagger(120 - i * 10),
            }
        )
        user_ids[email] = str(ins.inserted_id)

    admin = user_ids["admin@seed.demo"]
    manager = user_ids["manager@seed.demo"]
    alice = user_ids["alice@seed.demo"]
    bob = user_ids["bob@seed.demo"]
    carol = user_ids["carol@seed.demo"]
    all_members = [admin, manager, alice, bob, carol]

    print(f"Created {len(users_spec)} users (password: {DEFAULT_PASSWORD!r})")

    # ── Projects ───────────────────────────────────────────────────────────
    p1 = await db.projects.insert_one(
        {
            "name": "Customer Portal 2.0",
            "description": "Rewrite customer-facing portal with new auth and billing views.",
            "member_ids": all_members,
            "created_by": manager,
            "created_at": stagger(90),
        }
    )
    p2 = await db.projects.insert_one(
        {
            "name": "Internal Analytics",
            "description": "Executive dashboards and usage metrics pipeline.",
            "member_ids": [admin, manager, alice],
            "created_by": admin,
            "created_at": stagger(85),
        }
    )
    pid1, pid2 = str(p1.inserted_id), str(p2.inserted_id)
    print(f"Projects: {pid1}, {pid2}")

    # ── Sprints (project 1) ─────────────────────────────────────────────────
    s1 = await db.sprints.insert_one(
        {
            "name": f"Sprint — week of {today.isoformat()}",
            "project_id": pid1,
            "start_date": today.isoformat(),
            "end_date": sprint_end,
            "goal": "Ship OAuth, dashboard shell, and first billing API integration.",
            "created_at": stagger(70),
            "created_by": manager,
        }
    )
    s2 = await db.sprints.insert_one(
        {
            "name": "Next increment",
            "project_id": pid1,
            "start_date": sprint_next_start,
            "end_date": sprint_next_end,
            "goal": "Hardening, performance, and analytics widgets.",
            "created_at": stagger(65),
            "created_by": manager,
        }
    )
    sid1, sid2 = str(s1.inserted_id), str(s2.inserted_id)

    # ── Tasks ───────────────────────────────────────────────────────────────
    tasks_spec = [
        # (title, description, status, priority, deadline, sprint_id, assigned_to, is_delayed)
        (
            "Implement OAuth2 login flow",
            "PKCE + refresh tokens; support Google and Microsoft IdP.",
            "In Progress",
            6,
            d7,
            sid1,
            alice,
            False,
        ),
        (
            "Dashboard layout shell",
            "Responsive grid + sidebar; dark mode tokens.",
            "Review",
            5,
            d3,
            sid1,
            bob,
            False,
        ),
        (
            "Billing API client SDK",
            "Typed client for invoice and subscription endpoints.",
            "Todo",
            4,
            d10,
            sid1,
            alice,
            False,
        ),
        (
            "Write E2E tests for login",
            "Playwright coverage for happy path and lockout.",
            "Todo",
            3,
            d14,
            sid1,
            carol,
            False,
        ),
        (
            "Fix CSP violations on static assets",
            "Adjust helmet/CSP for Vite chunks.",
            "Backlog",
            2,
            d21,
            None,
            None,
            False,
        ),
        (
            "Delayed: migrate legacy session cookies",
            "Still blocking QA; needs owner.",
            "Todo",
            7,
            overdue_a,
            sid1,
            bob,
            True,
        ),
        (
            "Delayed: export report timeout",
            "Large CSV export times out after 60s.",
            "In Progress",
            8,
            overdue_b,
            sid1,
            alice,
            True,
        ),
        (
            "Done: repo scaffolding",
            "Monorepo + CI pipeline bootstrap.",
            "Done",
            1,
            today.isoformat(),
            sid1,
            alice,
            False,
        ),
        (
            "Product copy review",
            "Marketing strings for onboarding.",
            "Backlog",
            1,
            d14,
            None,
            carol,
            False,
        ),
        # Project 2
        (
            "Define metrics schema",
            "Snowflake dimensions for MAU and conversion.",
            "In Progress",
            5,
            d10,
            None,
            alice,
            False,
        ),
        (
            "Airflow DAG for nightly rollup",
            "Idempotent job with Slack alerts.",
            "Todo",
            4,
            d21,
            None,
            bob,
            False,
        ),
    ]

    task_rows = []
    for i, (title, desc, status, pri, deadline, spid, assign, is_delayed) in enumerate(tasks_spec):
        proj = pid1 if i < 9 else pid2
        task_rows.append(
            {
                "title": title,
                "description": desc,
                "status": status,
                "priority": pri,
                "deadline": deadline,
                "assigned_to": assign,
                "project_id": proj,
                "sprint_id": spid,
                "is_delayed": is_delayed,
                "created_at": stagger(60 - i * 3),
                "created_by": manager if proj == pid1 else admin,
            }
        )

    await db.tasks.insert_many(task_rows)
    print(f"Inserted {len(task_rows)} tasks")

    # ── Bugs (with embeddings) ──────────────────────────────────────────────
    bugs_spec = [
        (
            "Login form returns 500 on Safari",
            "Steps: open /login on Safari 17, submit valid credentials. Server returns 500.",
            "high",
            "open",
            alice,
        ),
        (
            "Safari: HTTP 500 when submitting login",
            "Same as other report — happens on iOS and macOS Safari after cache clear.",
            "high",
            "open",
            bob,
        ),
        (
            "Invoice PDF missing tax line",
            "German customers: VAT line not rendered in PDF download.",
            "medium",
            "open",
            carol,
        ),
        (
            "Webhook retries exhausted",
            "Stripe webhook returns 429; we never backoff correctly.",
            "critical",
            "open",
            alice,
        ),
        (
            "Typo in footer copyright year",
            "Shows 2024 instead of current year.",
            "low",
            "open",
            carol,
        ),
        (
            "Closed duplicate placeholder",
            "Merged into Safari login issue.",
            "medium",
            "closed",
            bob,
        ),
    ]

    bug_ids = []
    for title, desc, sev, st, reporter in bugs_spec:
        text = f"{title} {desc}"
        embedding = await _embed(text)
        ins = await db.bugs.insert_one(
            {
                "title": title,
                "description": desc,
                "severity": sev,
                "status": st,
                "task_id": None,
                "project_id": pid1,
                "embedding": embedding,
                "merged_into": None,
                "duplicate_of": None,
                "created_at": stagger(40 - len(bug_ids) * 5),
                "created_by": reporter,
            }
        )
        bug_ids.append(str(ins.inserted_id))

    # Mark last bug as duplicate of first (same root cause narrative)
    if len(bug_ids) >= 6:
        await db.bugs.update_one(
            {"_id": ObjectId(bug_ids[5])},
            {
                "$set": {
                    "duplicate_of": bug_ids[0],
                    "merged_into": bug_ids[0],
                    "status": "closed",
                }
            },
        )

    print(f"Inserted {len(bugs_spec)} bugs (with SBERT embeddings)")

    # ── Notifications ───────────────────────────────────────────────────────
    notifs = [
        (alice, "You were assigned: Implement OAuth2 login flow", "assignment"),
        (bob, "You were assigned: Dashboard layout shell", "assignment"),
        (alice, "Task 'Delayed: migrate legacy session cookies' is now delayed (past deadline)", "delay"),
        (manager, f"New sprint 'Sprint — week of {today.isoformat()}' created in project 'Customer Portal 2.0'", "sprint"),
        (bob, "You were added to project 'Customer Portal 2.0'", "project"),
        (carol, "Welcome to the Nexus PM seed dataset — data was generated today.", "info"),
    ]
    for i, (uid, msg, ntype) in enumerate(notifs):
        await db.notifications.insert_one(
            {
                "user_id": uid,
                "message": msg,
                "type": ntype,
                "read": i >= 4,
                "created_at": now - timedelta(hours=2, minutes=i * 12),
            }
        )
    print(f"Inserted {len(notifs)} notifications")

    # Recreate indexes (same as app startup)
    client = get_client()
    dbn = client[settings.DB_NAME]
    await dbn.tasks.create_index("project_id")
    await dbn.tasks.create_index("sprint_id")
    await dbn.tasks.create_index("assigned_to")
    await dbn.bugs.create_index("project_id")
    await dbn.notifications.create_index([("user_id", 1), ("read", 1)])

    print("\nDone. Log in at the frontend with any seeded email and the password above.")
    print(f"Reference date used: today={today.isoformat()} (UTC now≈{now.isoformat()})")


if __name__ == "__main__":
    asyncio.run(main())
