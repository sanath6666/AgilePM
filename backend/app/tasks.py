from datetime import date, datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from .access import (
    assert_project_access,
    assert_task_access,
    build_project_scope_query,
    is_admin,
    assert_manager_can_manage_project,
    load_sprint,
    load_project,
    member_project_ids,
)
from .dependencies import get_current_user, require_roles
from .database import get_database
from .models.schemas import TaskCreate, TaskUpdate, VALID_STATUSES
from .notifications import notify_user, notify_users

router = APIRouter()

MAX_PRIORITY = 10
DELAY_PRIORITY_BUMP = 2


def _fmt(t: dict) -> dict:
    t["id"] = str(t["_id"])
    del t["_id"]
    return t


def _is_delayed(task: dict) -> bool:
    deadline = task.get("deadline")
    if not deadline:
        return False
    try:
        d = date.fromisoformat(str(deadline)[:10])
    except ValueError:
        return False
    return date.today() > d and task.get("status", "") != "Done"


async def _recompute_task_delay(db, task: dict) -> dict:
    """Check and update is_delayed + priority for a single task. Returns updated task."""
    should_be_delayed = _is_delayed(task)
    was_delayed = task.get("is_delayed", False)

    update: dict = {}
    if should_be_delayed and not was_delayed:
        new_priority = min((task.get("priority") or 0) + DELAY_PRIORITY_BUMP, MAX_PRIORITY)
        update = {"is_delayed": True, "priority": new_priority}
        # Notify assigned user
        assigned = task.get("assigned_to")
        if assigned:
            await notify_user(
                assigned,
                f"Task '{task['title']}' is now delayed (past deadline)",
                "delay",
            )
    elif not should_be_delayed and was_delayed:
        update = {"is_delayed": False}

    if update:
        await db.tasks.update_one({"_id": task["_id"]}, {"$set": update})
        task.update(update)
    return task


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_task(body: TaskCreate, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ("admin", "manager"):
        raise HTTPException(403, "Only admin or manager can create tasks")
    if body.status not in VALID_STATUSES:
        raise HTTPException(400, f"Invalid status. Must be one of {VALID_STATUSES}")
    db = get_database()
    project = await assert_project_access(db, current_user, body.project_id)
    await assert_manager_can_manage_project(current_user, project)
    if body.sprint_id:
        sp = await load_sprint(db, body.sprint_id)
        if not sp:
            raise HTTPException(404, "Sprint not found")
        if sp["project_id"] != body.project_id:
            raise HTTPException(400, "Sprint does not belong to this project")
    doc = {
        **body.model_dump(),
        "is_delayed": False,
        "created_at": datetime.now(timezone.utc),
        "created_by": str(current_user["_id"]),
    }
    result = await db.tasks.insert_one(doc)

    if body.assigned_to:
        await notify_user(
            body.assigned_to,
            f"You were assigned task '{body.title}'",
            "assignment",
        )

    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc


@router.get("")
async def list_tasks(
    project_id: str | None = None,
    sprint_id: str | None = None,
    status: str | None = None,
    current_user: dict = Depends(get_current_user),
):
    db = get_database()
    scope = await build_project_scope_query(db, current_user, project_id, sprint_id=sprint_id)
    query = {**scope}
    if status:
        query["status"] = status

    tasks = await db.tasks.find(query).to_list(None)
    result = []
    for t in tasks:
        t = await _recompute_task_delay(db, t)
        result.append(_fmt(t))
    return result


@router.get("/delayed")
async def get_delayed_tasks(
    project_id: str | None = None,
    current_user: dict = Depends(get_current_user),
):
    """Return tasks where deadline has passed and status != Done."""
    db = get_database()
    today_str = date.today().isoformat()
    scope = await build_project_scope_query(db, current_user, project_id)
    query: dict = {
        **scope,
        "deadline": {"$lt": today_str, "$exists": True, "$ne": None},
        "status": {"$ne": "Done"},
    }

    tasks = await db.tasks.find(query).to_list(None)
    result = []
    for t in tasks:
        t = await _recompute_task_delay(db, t)
        result.append(_fmt(t))
    return result


@router.post("/recompute-delays")
async def recompute_all_delays(
    project_id: str | None = None,
    current_user: dict = Depends(require_roles("admin", "manager")),
):
    """Idempotently recompute is_delayed flag and priority bumps for all active tasks."""
    db = get_database()
    base: dict = {"status": {"$ne": "Done"}}
    if project_id:
        await assert_project_access(db, current_user, project_id)
        base["project_id"] = project_id
    elif not is_admin(current_user):
        ids = await member_project_ids(db, current_user)
        if not ids:
            return {"recomputed": 0, "newly_delayed": 0}
        base["project_id"] = {"$in": ids}
    tasks = await db.tasks.find(base).to_list(None)
    updated = 0
    for t in tasks:
        before = t.get("is_delayed", False)
        t = await _recompute_task_delay(db, t)
        if t.get("is_delayed", False) != before:
            updated += 1
    return {"recomputed": len(tasks), "newly_delayed": updated}


@router.get("/{task_id}")
async def get_task(task_id: str, current_user: dict = Depends(get_current_user)):
    db = get_database()
    t = await assert_task_access(db, current_user, task_id)
    t = await _recompute_task_delay(db, t)
    return _fmt(t)


@router.patch("/{task_id}")
async def update_task(
    task_id: str, body: TaskUpdate, current_user: dict = Depends(get_current_user)
):
    if current_user.get("role") not in ("admin", "manager"):
        raise HTTPException(403, "Only admin or manager can edit tasks")
    db = get_database()
    t = await assert_task_access(db, current_user, task_id)
    project = await load_project(db, t["project_id"])
    if not project:
        raise HTTPException(404, "Project not found")
    await assert_manager_can_manage_project(current_user, project)

    if body.status and body.status not in VALID_STATUSES:
        raise HTTPException(400, f"Invalid status. Must be one of {VALID_STATUSES}")

    # Use exclude_unset so explicitly-passed null values (e.g. sprint_id: null) are applied
    update = body.model_dump(exclude_unset=True)
    if "sprint_id" in update and update["sprint_id"]:
        sp = await load_sprint(db, update["sprint_id"])
        if not sp:
            raise HTTPException(404, "Sprint not found")
        if sp["project_id"] != t["project_id"]:
            raise HTTPException(400, "Sprint does not belong to this task's project")

    if update:
        await db.tasks.update_one({"_id": ObjectId(task_id)}, {"$set": update})
        t.update(update)

    # Notify new assignee
    old_assigned = t.get("assigned_to")
    new_assigned = body.assigned_to
    if new_assigned and new_assigned != old_assigned:
        await notify_user(
            new_assigned,
            f"You were assigned task '{t['title']}'",
            "assignment",
        )

    t = await _recompute_task_delay(db, t)
    return _fmt(t)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(task_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ("admin", "manager"):
        raise HTTPException(403, "Only admin or manager can delete tasks")
    db = get_database()
    t = await assert_task_access(db, current_user, task_id)
    project = await load_project(db, t["project_id"])
    if not project:
        raise HTTPException(404, "Project not found")
    await assert_manager_can_manage_project(current_user, project)
    result = await db.tasks.delete_one({"_id": ObjectId(task_id)})
    if result.deleted_count == 0:
        raise HTTPException(404, "Task not found")
