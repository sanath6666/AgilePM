"""
Seed script: creates an admin user if none exists.
Run from backend/ directory:
    python -m scripts.seed_admin
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import get_database
from app.auth import _hash


async def main():
    db = get_database()
    existing = await db.users.find_one({"role": "admin"})
    if existing:
        print(f"Admin already exists: {existing['email']}")
        return

    result = await db.users.insert_one(
        {
            "name": "Admin",
            "email": "admin@example.com",
            "hashed_password": _hash("admin123"),
            "role": "admin",
        }
    )
    print(f"Created admin user: admin@example.com / admin123 (id={result.inserted_id})")


if __name__ == "__main__":
    asyncio.run(main())
