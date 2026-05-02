from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from .dependencies import get_current_user
from .database import get_database
from .models.schemas import UserOut

router = APIRouter()


def _fmt(u: dict) -> UserOut:
    return UserOut(id=str(u["_id"]), name=u["name"], email=u["email"], role=u["role"])


@router.get("/me", response_model=UserOut)
async def me(current_user: dict = Depends(get_current_user)):
    return _fmt(current_user)


@router.get("", response_model=list[UserOut])
async def list_users(current_user: dict = Depends(get_current_user)):
    db = get_database()
    users = await db.users.find({}, {"hashed_password": 0}).to_list(None)
    return [_fmt(u) for u in users]


@router.get("/{user_id}", response_model=UserOut)
async def get_user(user_id: str, current_user: dict = Depends(get_current_user)):
    db = get_database()
    user = await db.users.find_one({"_id": ObjectId(user_id)}, {"hashed_password": 0})
    if not user:
        raise HTTPException(404, "User not found")
    return _fmt(user)
