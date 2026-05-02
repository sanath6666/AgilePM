import pytest
from httpx import AsyncClient

from tests.helpers import auth_headers


@pytest.mark.asyncio
async def test_enhance_bug_returns_503_without_openai(client: AsyncClient, manager_token: str):
    r = await client.post(
        "/ai/enhance-bug",
        headers=auth_headers(manager_token),
        json={
            "title": "Crash on save",
            "description": "App closes when I tap save on iOS 18.",
        },
    )
    assert r.status_code == 503
    assert "OPENAI_API_KEY" in r.json().get("detail", "")


@pytest.mark.asyncio
async def test_narrate_delays_returns_503_without_openai(client: AsyncClient, manager_token: str):
    r = await client.post(
        "/ai/narrate-delays",
        headers=auth_headers(manager_token),
        json={"delayed_count": 2, "on_time_count": 5, "sample_titles": ["Fix login"]},
    )
    assert r.status_code == 503
