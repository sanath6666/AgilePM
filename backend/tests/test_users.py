import pytest
from httpx import AsyncClient

from tests.helpers import auth_headers


@pytest.mark.asyncio
async def test_list_users_any_authenticated_role(client: AsyncClient, dev_token: str):
    """College demo: user directory is readable by any signed-in user (assignees, members UI)."""
    r = await client.get("/users", headers=auth_headers(dev_token))
    assert r.status_code == 200
    assert isinstance(r.json(), list)


@pytest.mark.asyncio
async def test_list_users_admin(client: AsyncClient, admin_token: str, dev_token: str):
    r = await client.get("/users", headers=auth_headers(admin_token))
    assert r.status_code == 200
    emails = {u["email"] for u in r.json()}
    assert "dev@test.dev" in emails


@pytest.mark.asyncio
async def test_get_user_by_id(client: AsyncClient, admin_token: str, dev_token: str):
    me = await client.get("/users/me", headers=auth_headers(dev_token))
    uid = me.json()["id"]
    r = await client.get(f"/users/{uid}", headers=auth_headers(admin_token))
    assert r.status_code == 200
    assert r.json()["id"] == uid


@pytest.mark.asyncio
async def test_get_user_not_found(client: AsyncClient, admin_token: str):
    r = await client.get(
        "/users/507f1f77bcf86cd799439011", headers=auth_headers(admin_token)
    )
    assert r.status_code == 404
