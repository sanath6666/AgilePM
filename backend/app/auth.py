from datetime import datetime, timedelta, timezone

from bson import ObjectId
from fastapi import APIRouter, HTTPException, status
from jose import jwt
from passlib.context import CryptContext

from .config import settings
from .database import get_database
from .models.schemas import LoginRequest, RegisterRequest, TokenResponse

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

VALID_ROLES = {"admin", "manager", "developer", "tester"}


def _hash(password: str) -> str:
    return pwd_context.hash(password)


def _verify(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def _create_token(user_id: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": user_id, "role": role, "exp": expire}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest):
    # College / demo: any role may self-register (including admin). Not for production.
    if body.role not in VALID_ROLES:
        raise HTTPException(400, f"Invalid role. Must be one of {VALID_ROLES}")
    db = get_database()
    if await db.users.find_one({"email": body.email}):
        raise HTTPException(400, "Email already registered")

    result = await db.users.insert_one(
        {
            "name": body.name,
            "email": body.email,
            "hashed_password": _hash(body.password),
            "role": body.role,
            "created_at": datetime.now(timezone.utc),
        }
    )
    token = _create_token(str(result.inserted_id), body.role)
    return TokenResponse(access_token=token)


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest):
    db = get_database()
    user = await db.users.find_one({"email": body.email})
    if not user or not _verify(body.password, user["hashed_password"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    token = _create_token(str(user["_id"]), user["role"])
    return TokenResponse(access_token=token)
