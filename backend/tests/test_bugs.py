import pytest
from httpx import AsyncClient

from tests.helpers import auth_headers


@pytest.mark.asyncio
async def test_create_list_bug(client: AsyncClient, manager_token: str):
    proj = await client.post(
        "/projects",
        headers=auth_headers(manager_token),
        json={"name": "BP", "description": ""},
    )
    pid = proj.json()["id"]
    r = await client.post(
        "/bugs",
        headers=auth_headers(manager_token),
        json={
            "title": "Crash",
            "description": "app crashes",
            "project_id": pid,
        },
    )
    assert r.status_code == 201
    bid = r.json()["id"]
    assert "embedding" not in r.json()

    r = await client.get("/bugs", headers=auth_headers(manager_token))
    assert any(b["id"] == bid for b in r.json())


@pytest.mark.asyncio
async def test_get_bug_404(client: AsyncClient, manager_token: str):
    r = await client.get(
        "/bugs/507f1f77bcf86cd799439011", headers=auth_headers(manager_token)
    )
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_update_bug(client: AsyncClient, manager_token: str):
    proj = await client.post(
        "/projects",
        headers=auth_headers(manager_token),
        json={"name": "BP2", "description": ""},
    )
    pid = proj.json()["id"]
    r = await client.post(
        "/bugs",
        headers=auth_headers(manager_token),
        json={"title": "b", "description": "d", "project_id": pid},
    )
    bid = r.json()["id"]
    r = await client.patch(
        f"/bugs/{bid}",
        headers=auth_headers(manager_token),
        json={"status": "closed"},
    )
    assert r.status_code == 200
    assert r.json()["status"] == "closed"


@pytest.mark.asyncio
async def test_merge_bugs(client: AsyncClient, manager_token: str):
    proj = await client.post(
        "/projects",
        headers=auth_headers(manager_token),
        json={"name": "BP3", "description": ""},
    )
    pid = proj.json()["id"]
    c = await client.post(
        "/bugs",
        headers=auth_headers(manager_token),
        json={"title": "canonical", "description": "x", "project_id": pid},
    )
    d = await client.post(
        "/bugs",
        headers=auth_headers(manager_token),
        json={"title": "dup", "description": "y", "project_id": pid},
    )
    cid, did = c.json()["id"], d.json()["id"]
    r = await client.post(
        "/bugs/merge",
        headers=auth_headers(manager_token),
        json={"canonical_bug_id": cid, "duplicate_bug_id": did},
    )
    assert r.status_code == 200
    dup = await client.get(f"/bugs/{did}", headers=auth_headers(manager_token))
    assert dup.json()["duplicate_of"] == cid
    canonical = await client.get(f"/bugs/{cid}", headers=auth_headers(manager_token))
    assert "Merged duplicate details" in canonical.json()["description"]
    assert "y" in canonical.json()["description"]


@pytest.mark.asyncio
async def test_merge_self_fails(client: AsyncClient, manager_token: str):
    proj = await client.post(
        "/projects",
        headers=auth_headers(manager_token),
        json={"name": "BP4", "description": ""},
    )
    pid = proj.json()["id"]
    c = await client.post(
        "/bugs",
        headers=auth_headers(manager_token),
        json={"title": "one", "description": "z", "project_id": pid},
    )
    cid = c.json()["id"]
    r = await client.post(
        "/bugs/merge",
        headers=auth_headers(manager_token),
        json={"canonical_bug_id": cid, "duplicate_bug_id": cid},
    )
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_similar_bugs_empty_embedding(
    client: AsyncClient, manager_token: str
):
    proj = await client.post(
        "/projects",
        headers=auth_headers(manager_token),
        json={"name": "BP5", "description": ""},
    )
    pid = proj.json()["id"]
    r = await client.post(
        "/bugs",
        headers=auth_headers(manager_token),
        json={"title": "solo", "description": "d", "project_id": pid},
    )
    bid = r.json()["id"]
    # embedding is filled async; may be [] briefly — endpoint returns [] if no embedding
    r = await client.get(
        f"/bugs/{bid}/similar", headers=auth_headers(manager_token)
    )
    assert r.status_code == 200
    assert isinstance(r.json(), list)


@pytest.mark.asyncio
async def test_developer_cannot_change_bug_severity(
    client: AsyncClient, manager_token: str, dev_token: str
):
    proj = await client.post(
        "/projects",
        headers=auth_headers(manager_token),
        json={"name": "Sev", "description": ""},
    )
    pid = proj.json()["id"]
    dev_me = await client.get("/users/me", headers=auth_headers(dev_token))
    dev_id = dev_me.json()["id"]
    await client.post(
        f"/projects/{pid}/members",
        headers=auth_headers(manager_token),
        json={"user_id": dev_id},
    )
    b = await client.post(
        "/bugs",
        headers=auth_headers(dev_token),
        json={"title": "x", "description": "d", "project_id": pid},
    )
    bid = b.json()["id"]
    r = await client.patch(
        f"/bugs/{bid}",
        headers=auth_headers(dev_token),
        json={"severity": "critical"},
    )
    assert r.status_code == 403
