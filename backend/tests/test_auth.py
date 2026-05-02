import pytest
from httpx import AsyncClient

from tests.helpers import auth_headers, register_user


@pytest.mark.asyncio
async def test_register_and_login(client: AsyncClient):
    await register_user(client, "u1@test.dev", "pw123456", "developer")
    r = await client.post(
        "/auth/login", json={"email": "u1@test.dev", "password": "pw123456"}
    )
    assert r.status_code == 200
    assert "access_token" in r.json()


@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient):
    await register_user(client, "dup@test.dev", "pw123456", "developer")
    r = await client.post(
        "/auth/register",
        json={
            "name": "X",
            "email": "dup@test.dev",
            "password": "other",
            "role": "developer",
        },
    )
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_register_invalid_role(client: AsyncClient):
    r = await client.post(
        "/auth/register",
        json={
            "name": "X",
            "email": "badrole@test.dev",
            "password": "pw123456",
            "role": "superuser",
        },
    )
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_login_invalid_credentials(client: AsyncClient):
    await register_user(client, "login@test.dev", "rightpass", "developer")
    r = await client.post(
        "/auth/login", json={"email": "login@test.dev", "password": "wrong"}
    )
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_me_requires_auth(client: AsyncClient):
    r = await client.get("/users/me")
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_me_with_token(client: AsyncClient, dev_token: str):
    r = await client.get("/users/me", headers=auth_headers(dev_token))
    assert r.status_code == 200
    data = r.json()
    assert data["email"] == "dev@test.dev"
    assert data["role"] == "developer"
