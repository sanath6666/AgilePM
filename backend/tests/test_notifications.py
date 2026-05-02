import pytest
from httpx import AsyncClient

from tests.helpers import auth_headers


@pytest.mark.asyncio
async def test_notifications_from_task_assign(
    client: AsyncClient, manager_token: str, dev_token: str
):
    proj = await client.post(
        "/projects",
        headers=auth_headers(manager_token),
        json={"name": "NP", "description": ""},
    )
    pid = proj.json()["id"]
    dev_me = await client.get("/users/me", headers=auth_headers(dev_token))
    dev_id = dev_me.json()["id"]
    await client.post(
        f"/projects/{pid}/members",
        headers=auth_headers(manager_token),
        json={"user_id": dev_id},
    )

    await client.post(
        "/tasks",
        headers=auth_headers(manager_token),
        json={
            "title": "for dev",
            "project_id": pid,
            "status": "Todo",
            "assigned_to": dev_id,
        },
    )

    r = await client.get(
        "/notifications", headers=auth_headers(dev_token)
    )
    assert r.status_code == 200
    msgs = [n["message"] for n in r.json()]
    assert any("assigned" in m.lower() for m in msgs)


@pytest.mark.asyncio
async def test_mark_read_and_read_all(client: AsyncClient, dev_token: str):
    from app.database import get_database

    db = get_database()
    me = await client.get("/users/me", headers=auth_headers(dev_token))
    uid = me.json()["id"]
    ins = await db.notifications.insert_one(
        {
            "user_id": uid,
            "message": "manual",
            "type": "info",
            "read": False,
        }
    )
    nid = str(ins.inserted_id)

    r = await client.patch(
        f"/notifications/{nid}/read", headers=auth_headers(dev_token)
    )
    assert r.status_code == 200

    await db.notifications.insert_one(
        {
            "user_id": uid,
            "message": "n2",
            "type": "info",
            "read": False,
        }
    )
    r = await client.patch(
        "/notifications/read-all", headers=auth_headers(dev_token)
    )
    assert r.status_code == 200
