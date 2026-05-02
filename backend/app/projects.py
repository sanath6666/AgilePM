from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from .access import assert_manager_can_manage_project
from .dependencies import get_current_user, require_roles
from .database import get_database
from .models.schemas import MemberUpdate, ProjectCreate, ProjectUpdate
from .notifications import notify_user, send_email_notification

router = APIRouter()


def _fmt(p: dict) -> dict:
    p["id"] = str(p["_id"])
    del p["_id"]
    return p


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_project(
    body: ProjectCreate,
    current_user: dict = Depends(require_roles("admin", "manager")),
):
    db = get_database()
    creator_id = str(current_user["_id"])
    doc = {
        "name": body.name,
        "description": body.description,
        "member_ids": [creator_id],
        "created_by": creator_id,
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.projects.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc


@router.get("")
async def list_projects(current_user: dict = Depends(get_current_user)):
    db = get_database()
    projects = await db.projects.find({}).to_list(None)
    return [_fmt(p) for p in projects]


@router.get("/{project_id}")
async def get_project(project_id: str, current_user: dict = Depends(get_current_user)):
    db = get_database()
    p = await db.projects.find_one({"_id": ObjectId(project_id)})
    if not p:
        raise HTTPException(404, "Project not found")
    return _fmt(p)


@router.patch("/{project_id}")
async def update_project(
    project_id: str,
    body: ProjectUpdate,
    current_user: dict = Depends(require_roles("admin", "manager")),
):
    db = get_database()
    p = await db.projects.find_one({"_id": ObjectId(project_id)})
    if not p:
        raise HTTPException(404, "Project not found")
    await assert_manager_can_manage_project(current_user, p)
    update = {k: v for k, v in body.model_dump().items() if v is not None}
    if update:
        await db.projects.update_one({"_id": ObjectId(project_id)}, {"$set": update})
    return {"ok": True}


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: str,
    current_user: dict = Depends(require_roles("admin", "manager")),
):
    db = get_database()
    p = await db.projects.find_one({"_id": ObjectId(project_id)})
    if not p:
        raise HTTPException(404, "Project not found")
    await assert_manager_can_manage_project(current_user, p)
    result = await db.projects.delete_one({"_id": ObjectId(project_id)})
    if result.deleted_count == 0:
        raise HTTPException(404, "Project not found")


@router.post("/{project_id}/members")
async def add_member(
    project_id: str,
    body: MemberUpdate,
    current_user: dict = Depends(require_roles("admin", "manager")),
):
    db = get_database()
    p = await db.projects.find_one({"_id": ObjectId(project_id)})
    if not p:
        raise HTTPException(404, "Project not found")
    user = await db.users.find_one({"_id": ObjectId(body.user_id)})
    if not user:
        raise HTTPException(404, "User not found")
    await assert_manager_can_manage_project(current_user, p)
    await db.projects.update_one(
        {"_id": ObjectId(project_id)},
        {"$addToSet": {"member_ids": body.user_id}},
    )
    await notify_user(body.user_id, f"You were added to project '{p['name']}'", "project")
    await send_email_notification(
        user.get("email", ""),
        f"Added to project: {p['name']}",
        (
            f"Hello {user.get('name', 'there')},\n\n"
            f"You were added to project '{p['name']}' in the Agile PM system.\n"
            "Please log in to view tasks and bugs assigned to you.\n"
        ),
    )
    return {"ok": True}


@router.delete("/{project_id}/members/{user_id}")
async def remove_member(
    project_id: str,
    user_id: str,
    current_user: dict = Depends(require_roles("admin", "manager")),
):
    db = get_database()
    p = await db.projects.find_one({"_id": ObjectId(project_id)})
    if not p:
        raise HTTPException(404, "Project not found")
    await assert_manager_can_manage_project(current_user, p)
    await db.projects.update_one(
        {"_id": ObjectId(project_id)},
        {"$pull": {"member_ids": user_id}},
    )
    return {"ok": True}
