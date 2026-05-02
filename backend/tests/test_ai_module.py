from pathlib import Path

import pytest
from httpx import AsyncClient

from tests.helpers import auth_headers


@pytest.mark.asyncio
async def test_check_duplicate_no_bugs(
    client: AsyncClient, manager_token: str
):
    proj = await client.post(
        "/projects",
        headers=auth_headers(manager_token),
        json={"name": "AI", "description": ""},
    )
    pid = proj.json()["id"]
    r = await client.post(
        "/ai/check-duplicate",
        headers=auth_headers(manager_token),
        json={"description": "something", "project_id": pid},
    )
    assert r.status_code == 200
    assert r.json()["is_duplicate"] is False


@pytest.mark.asyncio
async def test_check_duplicate_match(
    client: AsyncClient, manager_token: str, fake_embedding: list
):
    from app.database import get_database

    proj = await client.post(
        "/projects",
        headers=auth_headers(manager_token),
        json={"name": "AI2", "description": ""},
    )
    pid = proj.json()["id"]
    db = get_database()
    await db.bugs.insert_one(
        {
            "title": "existing",
            "description": "d",
            "severity": "low",
            "status": "open",
            "project_id": pid,
            "embedding": list(fake_embedding),
        }
    )

    r = await client.post(
        "/ai/check-duplicate",
        headers=auth_headers(manager_token),
        json={"description": "totally different words", "project_id": pid},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["is_duplicate"] is True
    assert data.get("matched_bug_title") == "existing"


@pytest.mark.asyncio
async def test_check_duplicate_exact_description_match(
    client: AsyncClient, manager_token: str
):
    proj = await client.post(
        "/projects",
        headers=auth_headers(manager_token),
        json={"name": "AI3", "description": ""},
    )
    pid = proj.json()["id"]
    await client.post(
        "/bugs",
        headers=auth_headers(manager_token),
        json={
            "title": "Login fails",
            "description": "App crashes when clicking login button after entering valid credentials",
            "project_id": pid,
        },
    )
    r = await client.post(
        "/ai/check-duplicate",
        headers=auth_headers(manager_token),
        json={
            "description": "App crashes when clicking login button after entering valid credentials",
            "project_id": pid,
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert data["is_duplicate"] is True
    assert data["similarity_score"] == 1.0


@pytest.mark.asyncio
async def test_cosine_similarity_unit():
    from app.ai_module import cosine_similarity

    a = [1.0, 0.0, 0.0]
    b = [1.0, 0.0, 0.0]
    assert abs(cosine_similarity(a, b) - 1.0) < 1e-5

    assert cosine_similarity([], []) == 0.0


def test_bundled_sbert_bug_duplicates_present():
    from app.ai_module import resolve_sbert_model_path

    root = Path(resolve_sbert_model_path())
    assert root.is_dir()
    assert (root / "model.safetensors").is_file()
    assert (root / "config.json").is_file()
