from httpx import AsyncClient


async def register_user(
    client: AsyncClient, email: str, password: str, role: str, name: str = "T"
) -> str:
    r = await client.post(
        "/auth/register",
        json={"name": name, "email": email, "password": password, "role": role},
    )
    assert r.status_code == 201, r.text
    return r.json()["access_token"]


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}
