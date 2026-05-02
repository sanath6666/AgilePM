import pytest
from httpx import AsyncClient

from tests.helpers import auth_headers


@pytest.mark.asyncio
async def test_dashboard_summary(client: AsyncClient, manager_token: str):
    proj = await client.post(
        "/projects",
        headers=auth_headers(manager_token),
        json={"name": "Dash", "description": ""},
    )
    pid = proj.json()["id"]
    await client.post(
        "/tasks",
        headers=auth_headers(manager_token),
        json={"title": "t", "project_id": pid, "status": "Todo"},
    )
    await client.post(
        "/bugs",
        headers=auth_headers(manager_token),
        json={"title": "b", "description": "x", "project_id": pid},
    )

    r = await client.get(
        f"/dashboard/summary?project_id={pid}",
        headers=auth_headers(manager_token),
    )
    assert r.status_code == 200
    data = r.json()
    assert data["total_tasks"] >= 1
    assert data["total_bugs"] >= 1
    assert "tasks_by_status" in data


@pytest.mark.asyncio
async def test_delay_analytics(client: AsyncClient, manager_token: str):
    proj = await client.post(
        "/projects",
        headers=auth_headers(manager_token),
        json={"name": "Dash2", "description": ""},
    )
    pid = proj.json()["id"]
    r = await client.get(
        f"/dashboard/delay-analytics?project_id={pid}",
        headers=auth_headers(manager_token),
    )
    assert r.status_code == 200
    body = r.json()
    assert "delayed_count" in body
    assert "monthly_trend" in body
