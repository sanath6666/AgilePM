import pytest
from httpx import AsyncClient

from tests.helpers import auth_headers


@pytest.mark.asyncio
async def test_create_sprint_requires_manager(
    client: AsyncClient, dev_token: str, manager_token: str
):
    proj = await client.post(
        "/projects",
        headers=auth_headers(manager_token),
        json={"name": "SP", "description": ""},
    )
    pid = proj.json()["id"]
    r = await client.post(
        "/sprints",
        headers=auth_headers(dev_token),
        json={"name": "S1", "project_id": pid},
    )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_sprint_crud(client: AsyncClient, manager_token: str):
    proj = await client.post(
        "/projects",
        headers=auth_headers(manager_token),
        json={"name": "SP2", "description": ""},
    )
    pid = proj.json()["id"]
    r = await client.post(
        "/sprints",
        headers=auth_headers(manager_token),
        json={"name": "Sprint A", "project_id": pid, "goal": "ship"},
    )
    assert r.status_code == 201
    sid = r.json()["id"]

    r = await client.get(
        f"/sprints?project_id={pid}", headers=auth_headers(manager_token)
    )
    assert any(s["id"] == sid for s in r.json())

    r = await client.get(f"/sprints/{sid}", headers=auth_headers(manager_token))
    assert r.status_code == 200

    r = await client.patch(
        f"/sprints/{sid}",
        headers=auth_headers(manager_token),
        json={"goal": "done"},
    )
    assert r.status_code == 200

    tid_body = await client.post(
        "/tasks",
        headers=auth_headers(manager_token),
        json={
            "title": "in sprint",
            "project_id": pid,
            "sprint_id": sid,
            "status": "Todo",
        },
    )
    assert tid_body.status_code == 201

    r = await client.get(
        f"/sprints/{sid}/tasks", headers=auth_headers(manager_token)
    )
    assert r.status_code == 200
    assert len(r.json()) >= 1

    r = await client.delete(f"/sprints/{sid}", headers=auth_headers(manager_token))
    assert r.status_code == 204
