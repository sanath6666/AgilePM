"""
Project-scoped access control.

- Everyone can view project-scoped data.
- Admin: full access to all projects and resources.
- Manager mutations are project-scoped: manager must be a member of that project.
"""
from __future__ import annotations

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import HTTPException, status


def uid_str(user: dict) -> str:
    return str(user["_id"])


def is_admin(user: dict) -> bool:
    return user.get("role") == "admin"


def _member_ids(project: dict) -> set[str]:
    return set(project.get("member_ids") or [])


async def load_project(db, project_id: str) -> dict | None:
    try:
        return await db.projects.find_one({"_id": ObjectId(project_id)})
    except InvalidId:
        return None


async def load_sprint(db, sprint_id: str) -> dict | None:
    try:
        return await db.sprints.find_one({"_id": ObjectId(sprint_id)})
    except InvalidId:
        return None


async def load_task(db, task_id: str) -> dict | None:
    try:
        return await db.tasks.find_one({"_id": ObjectId(task_id)})
    except InvalidId:
        return None


async def load_bug(db, bug_id: str) -> dict | None:
    try:
        return await db.bugs.find_one({"_id": ObjectId(bug_id)})
    except InvalidId:
        return None


async def member_project_ids(db, user: dict) -> list[str]:
    """ObjectIds as strings for projects the user belongs to."""
    if is_admin(user):
        return []
    uid = uid_str(user)
    rows = await db.projects.find({"member_ids": uid}, {"_id": 1}).to_list(None)
    return [str(r["_id"]) for r in rows]


async def assert_project_access(db, user: dict, project_id: str) -> dict:
    """Return project if it exists (view access is open to all roles)."""
    p = await load_project(db, project_id)
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    return p


async def assert_project_member(user: dict, project: dict) -> None:
    """Require admin or membership in this project."""
    if is_admin(user):
        return
    if uid_str(user) in _member_ids(project):
        return
    raise HTTPException(status.HTTP_403_FORBIDDEN, "Not a project member")


async def assert_manager_can_manage_project(user: dict, project: dict) -> None:
    """Admin, or manager who is a member of this project."""
    if is_admin(user):
        return
    if user.get("role") != "manager":
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Requires one of roles: ('admin', 'manager')",
        )
    if uid_str(user) not in _member_ids(project):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Managers must be members of this project to manage it",
        )


async def assert_task_access(db, user: dict, task_id: str) -> dict:
    t = await load_task(db, task_id)
    if not t:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found")
    await assert_project_access(db, user, t["project_id"])
    return t


async def assert_bug_access(db, user: dict, bug_id: str) -> dict:
    b = await load_bug(db, bug_id)
    if not b:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Bug not found")
    await assert_project_access(db, user, b["project_id"])
    return b


async def assert_sprint_access(db, user: dict, sprint_id: str) -> dict:
    s = await load_sprint(db, sprint_id)
    if not s:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sprint not found")
    await assert_project_access(db, user, s["project_id"])
    return s


async def build_project_scope_query(
    db,
    user: dict,
    project_id: str | None,
    *,
    sprint_id: str | None = None,
) -> dict:
    """
    Build a Mongo filter on ``project_id`` for list endpoints.
    Resolves sprint to a project when only sprint_id is given.
    """
    if project_id:
        await assert_project_access(db, user, project_id)
        q: dict = {"project_id": project_id}
        if sprint_id:
            s = await load_sprint(db, sprint_id)
            if not s:
                raise HTTPException(status.HTTP_404_NOT_FOUND, "Sprint not found")
            if s["project_id"] != project_id:
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    "Sprint does not belong to this project",
                )
            q["sprint_id"] = sprint_id
        return q

    if sprint_id:
        s = await load_sprint(db, sprint_id)
        if not s:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Sprint not found")
        await assert_project_access(db, user, s["project_id"])
        return {"sprint_id": sprint_id, "project_id": s["project_id"]}

    return {}
