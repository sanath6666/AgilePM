from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from .access import (
    assert_manager_can_manage_project,
    assert_project_access,
    assert_sprint_access,
    build_project_scope_query,
    load_project,
)
from .dependencies import get_current_user, require_roles
from .database import get_database
from .models.schemas import SprintCreate, SprintUpdate
from .notifications import notify_users

router = APIRouter()


def _fmt(s: dict) -> dict:
    s["id"] = str(s["_id"])
    del s["_id"]
    return s


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_sprint(
    body: SprintCreate,
    current_user: dict = Depends(require_roles("admin", "manager")),
):
    db = get_database()
    project = await assert_project_access(db, current_user, body.project_id)
    await assert_manager_can_manage_project(current_user, project)

    doc = {
        **body.model_dump(),
        "created_at": datetime.now(timezone.utc),
        "created_by": str(current_user["_id"]),
    }
    result = await db.sprints.insert_one(doc)

    # Notify all project members
    member_ids = project.get("member_ids", [])
    await notify_users(
        member_ids,
        f"New sprint '{body.name}' created in project '{project['name']}'",
        "sprint",
    )

    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc


@router.get("")
async def list_sprints(
    project_id: str | None = None,
    current_user: dict = Depends(get_current_user),
):
    db = get_database()
    scope = await build_project_scope_query(db, current_user, project_id)
    sprints = await db.sprints.find(scope).to_list(None)
    return [_fmt(s) for s in sprints]


@router.get("/{sprint_id}")
async def get_sprint(sprint_id: str, current_user: dict = Depends(get_current_user)):
    db = get_database()
    s = await assert_sprint_access(db, current_user, sprint_id)
    return _fmt(s)


@router.get("/{sprint_id}/tasks")
async def get_sprint_tasks(sprint_id: str, current_user: dict = Depends(get_current_user)):
    db = get_database()
    await assert_sprint_access(db, current_user, sprint_id)
    tasks = await db.tasks.find({"sprint_id": sprint_id}).to_list(None)
    result = []
    for t in tasks:
        t["id"] = str(t["_id"])
        del t["_id"]
        result.append(t)
    return result


@router.patch("/{sprint_id}")
async def update_sprint(
    sprint_id: str,
    body: SprintUpdate,
    current_user: dict = Depends(require_roles("admin", "manager")),
):
    db = get_database()
    s = await assert_sprint_access(db, current_user, sprint_id)
    p = await load_project(db, s["project_id"])
    await assert_manager_can_manage_project(current_user, p)
    update = {k: v for k, v in body.model_dump().items() if v is not None}
    if update:
        await db.sprints.update_one({"_id": ObjectId(sprint_id)}, {"$set": update})

        # Notify project members
        project = await db.projects.find_one({"_id": ObjectId(s["project_id"])})
        if project:
            await notify_users(
                project.get("member_ids", []),
                f"Sprint '{s['name']}' was updated",
                "sprint",
            )
    return {"ok": True}


@router.delete("/{sprint_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_sprint(
    sprint_id: str,
    current_user: dict = Depends(require_roles("admin", "manager")),
):
    db = get_database()
    s = await assert_sprint_access(db, current_user, sprint_id)
    p = await load_project(db, s["project_id"])
    await assert_manager_can_manage_project(current_user, p)
    result = await db.sprints.delete_one({"_id": ObjectId(sprint_id)})
    if result.deleted_count == 0:
        raise HTTPException(404, "Sprint not found")
