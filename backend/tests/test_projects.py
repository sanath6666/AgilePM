import pytest
from httpx import AsyncClient

from tests.helpers import auth_headers


@pytest.mark.asyncio
async def test_create_project_manager(client: AsyncClient, manager_token: str):
    r = await client.post(
        "/projects",
        headers=auth_headers(manager_token),
        json={"name": "P1", "description": "d"},
    )
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "P1"
    assert "id" in data


@pytest.mark.asyncio
async def test_create_project_forbidden_developer(client: AsyncClient, dev_token: str):
    r = await client.post(
        "/projects",
        headers=auth_headers(dev_token),
        json={"name": "X", "description": ""},
    )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_list_projects_member_filter(
    client: AsyncClient, manager_token: str, dev_token: str
):
    r = await client.post(
        "/projects",
        headers=auth_headers(manager_token),
        json={"name": "MemberProj", "description": ""},
    )
    pid = r.json()["id"]

    r = await client.get("/projects", headers=auth_headers(manager_token))
    assert r.status_code == 200
    assert any(p["id"] == pid for p in r.json())

    r = await client.get("/projects", headers=auth_headers(dev_token))
    assert r.status_code == 200
    assert not any(p["id"] == pid for p in r.json())


@pytest.mark.asyncio
async def test_get_project_404(client: AsyncClient, admin_token: str):
    r = await client.get(
        "/projects/507f1f77bcf86cd799439011", headers=auth_headers(admin_token)
    )
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_add_member(
    client: AsyncClient, manager_token: str, dev_token: str
):
    proj = await client.post(
        "/projects",
        headers=auth_headers(manager_token),
        json={"name": "WithMember", "description": ""},
    )
    pid = proj.json()["id"]
    dev_me = await client.get("/users/me", headers=auth_headers(dev_token))
    dev_id = dev_me.json()["id"]

    r = await client.post(
        f"/projects/{pid}/members",
        headers=auth_headers(manager_token),
        json={"user_id": dev_id},
    )
    assert r.status_code == 200

    listed = await client.get("/projects", headers=auth_headers(dev_token))
    assert any(p["id"] == pid for p in listed.json())


@pytest.mark.asyncio
async def test_manager_cannot_modify_project_without_membership(
    client: AsyncClient, manager_token: str, manager_b_token: str
):
    proj = await client.post(
        "/projects",
        headers=auth_headers(manager_token),
        json={"name": "OwnedByA", "description": ""},
    )
    pid = proj.json()["id"]
    r = await client.patch(
        f"/projects/{pid}",
        headers=auth_headers(manager_b_token),
        json={"name": "Hacked"},
    )
    assert r.status_code == 403
