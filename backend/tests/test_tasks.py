from datetime import date, timedelta

import pytest
from httpx import AsyncClient

from tests.helpers import auth_headers


@pytest.mark.asyncio
async def test_create_task_invalid_status(
    client: AsyncClient, manager_token: str
):
    proj = await client.post(
        "/projects",
        headers=auth_headers(manager_token),
        json={"name": "TP", "description": ""},
    )
    pid = proj.json()["id"]
    r = await client.post(
        "/tasks",
        headers=auth_headers(manager_token),
        json={
            "title": "t1",
            "project_id": pid,
            "status": "Invalid",
        },
    )
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_create_list_get_task(client: AsyncClient, manager_token: str):
    proj = await client.post(
        "/projects",
        headers=auth_headers(manager_token),
        json={"name": "TP2", "description": ""},
    )
    pid = proj.json()["id"]
    r = await client.post(
        "/tasks",
        headers=auth_headers(manager_token),
        json={
            "title": "My task",
            "description": "",
            "status": "Todo",
            "priority": 3,
            "project_id": pid,
        },
    )
    assert r.status_code == 201
    tid = r.json()["id"]

    r = await client.get("/tasks", headers=auth_headers(manager_token))
    assert r.status_code == 200
    assert any(t["id"] == tid for t in r.json())

    r = await client.get(f"/tasks/{tid}", headers=auth_headers(manager_token))
    assert r.status_code == 200
    assert r.json()["title"] == "My task"


@pytest.mark.asyncio
async def test_filter_tasks_by_project(
    client: AsyncClient, manager_token: str
):
    proj = await client.post(
        "/projects",
        headers=auth_headers(manager_token),
        json={"name": "TP3", "description": ""},
    )
    pid = proj.json()["id"]
    await client.post(
        "/tasks",
        headers=auth_headers(manager_token),
        json={"title": "only", "project_id": pid, "status": "Backlog"},
    )
    r = await client.get(
        f"/tasks?project_id={pid}", headers=auth_headers(manager_token)
    )
    assert r.status_code == 200
    assert all(t["project_id"] == pid for t in r.json())


@pytest.mark.asyncio
async def test_update_task(client: AsyncClient, manager_token: str):
    proj = await client.post(
        "/projects",
        headers=auth_headers(manager_token),
        json={"name": "TP4", "description": ""},
    )
    pid = proj.json()["id"]
    r = await client.post(
        "/tasks",
        headers=auth_headers(manager_token),
        json={"title": "u", "project_id": pid, "status": "Backlog"},
    )
    tid = r.json()["id"]
    r = await client.patch(
        f"/tasks/{tid}",
        headers=auth_headers(manager_token),
        json={"status": "In Progress"},
    )
    assert r.status_code == 200
    assert r.json()["status"] == "In Progress"


@pytest.mark.asyncio
async def test_delete_task(client: AsyncClient, manager_token: str):
    proj = await client.post(
        "/projects",
        headers=auth_headers(manager_token),
        json={"name": "TP5", "description": ""},
    )
    pid = proj.json()["id"]
    r = await client.post(
        "/tasks",
        headers=auth_headers(manager_token),
        json={"title": "del", "project_id": pid, "status": "Backlog"},
    )
    tid = r.json()["id"]
    r = await client.delete(f"/tasks/{tid}", headers=auth_headers(manager_token))
    assert r.status_code == 204


@pytest.mark.asyncio
async def test_recompute_delays(client: AsyncClient, manager_token: str):
    proj = await client.post(
        "/projects",
        headers=auth_headers(manager_token),
        json={"name": "TP6", "description": ""},
    )
    pid = proj.json()["id"]
    past = (date.today() - timedelta(days=2)).isoformat()
    await client.post(
        "/tasks",
        headers=auth_headers(manager_token),
        json={
            "title": "late",
            "project_id": pid,
            "status": "Todo",
            "deadline": past,
            "priority": 1,
        },
    )
    r = await client.post(
        "/tasks/recompute-delays", headers=auth_headers(manager_token)
    )
    assert r.status_code == 200
    body = r.json()
    assert "recomputed" in body


@pytest.mark.asyncio
async def test_recompute_delays_forbidden_for_developer(
    client: AsyncClient, dev_token: str
):
    r = await client.post("/tasks/recompute-delays", headers=auth_headers(dev_token))
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_developer_cannot_access_foreign_task(
    client: AsyncClient, manager_token: str, dev_token: str
):
    proj = await client.post(
        "/projects",
        headers=auth_headers(manager_token),
        json={"name": "Iso", "description": ""},
    )
    pid = proj.json()["id"]
    t = await client.post(
        "/tasks",
        headers=auth_headers(manager_token),
        json={"title": "secret", "project_id": pid, "status": "Backlog"},
    )
    tid = t.json()["id"]
    r = await client.get(f"/tasks/{tid}", headers=auth_headers(dev_token))
    assert r.status_code == 403
