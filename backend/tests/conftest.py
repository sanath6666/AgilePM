import os

# Force isolated test DB and predictable JWT so `.env` cannot point tests at dev data.
os.environ["DB_NAME"] = "agile_pm_pytest"
os.environ.setdefault("MONGODB_URI", "mongodb://localhost:27017")
os.environ["JWT_SECRET"] = "test_jwt_secret_for_pytest_only"
os.environ["OPENAI_API_KEY"] = ""
os.environ["SBERT_MODEL_PATH"] = ""

import pytest
from httpx import ASGITransport, AsyncClient

import app.database as database_module
from app.database import get_database
from app.main import app

from tests.helpers import register_user


COLLECTIONS = ("users", "projects", "tasks", "bugs", "sprints", "notifications")


@pytest.fixture(autouse=True)
def reset_motor_client():
    """Motor binds to the running event loop; pytest-asyncio uses a fresh loop per test."""
    database_module._client = None
    yield
    database_module._client = None


@pytest.fixture(autouse=True)
async def _clean_collections(reset_motor_client):
    """Clear collections before each test (no async teardown — loop may be closed after yield)."""
    db = get_database()
    for name in COLLECTIONS:
        if name in await db.list_collection_names():
            await db[name].delete_many({})
    yield


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def fake_embedding():
    v = [0.0] * 384
    v[0] = 1.0
    return v


@pytest.fixture(autouse=True)
def mock_bug_encode(monkeypatch, fake_embedding):
    import app.bugs as bugs_mod

    def _fake_encode(text: str):
        return list(fake_embedding)

    monkeypatch.setattr(bugs_mod, "encode", _fake_encode)


@pytest.fixture(autouse=True)
def mock_ai_encode(monkeypatch, fake_embedding):
    import app.ai_module as ai_mod

    def _fake_encode(text: str):
        return list(fake_embedding)

    monkeypatch.setattr(ai_mod, "encode", _fake_encode)


@pytest.fixture
async def admin_token(client):
    return await register_user(client, "admin@test.dev", "secret123", "admin", "Admin")


@pytest.fixture
async def manager_token(client):
    return await register_user(client, "mgr@test.dev", "secret123", "manager", "Mgr")


@pytest.fixture
async def dev_token(client):
    return await register_user(client, "dev@test.dev", "secret123", "developer", "Dev")


@pytest.fixture
async def manager_b_token(client):
    return await register_user(client, "mgrb@test.dev", "secret123", "manager", "Mgr B")


