import asyncio
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status

from .access import (
    assert_bug_access,
    assert_project_access,
    assert_project_member,
    assert_manager_can_manage_project,
    build_project_scope_query,
    load_project,
)
from .dependencies import get_current_user, require_roles
from .database import get_database
from .models.schemas import BugCreate, BugMergeRequest, BugUpdate
from .notifications import notify_user
from .ai_module import encode

router = APIRouter()


def _fmt(b: dict) -> dict:
    b["id"] = str(b["_id"])
    del b["_id"]
    # Don't expose raw embedding in API responses
    b.pop("embedding", None)
    return b


async def _compute_and_store_embedding(db, bug_id: ObjectId, text: str):
    loop = asyncio.get_event_loop()
    embedding = await loop.run_in_executor(None, encode, text)
    await db.bugs.update_one({"_id": bug_id}, {"$set": {"embedding": embedding}})


def _merge_descriptions(canonical: str, duplicate: str) -> str:
    canonical_text = (canonical or "").strip()
    duplicate_text = (duplicate or "").strip()
    if not canonical_text:
        return duplicate_text
    if not duplicate_text:
        return canonical_text
    if duplicate_text.lower() in canonical_text.lower():
        return canonical_text

    canonical_lines = [ln.strip() for ln in canonical_text.splitlines() if ln.strip()]
    existing = {ln.lower() for ln in canonical_lines}
    extra_lines = []
    for ln in duplicate_text.splitlines():
        stripped = ln.strip()
        if stripped and stripped.lower() not in existing:
            extra_lines.append(stripped)
            existing.add(stripped.lower())

    if not extra_lines:
        return canonical_text
    return f"{canonical_text}\n\n---\nMerged duplicate details:\n" + "\n".join(extra_lines)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_bug(
    body: BugCreate,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
):
    db = get_database()
    role = current_user.get("role")
    if role not in ("admin", "manager", "developer", "tester"):
        raise HTTPException(403, "Your role is not allowed to report bugs")
    project = await assert_project_access(db, current_user, body.project_id)
    await assert_project_member(current_user, project)
    doc = {
        **body.model_dump(),
        "embedding": [],
        "merged_into": None,
        "duplicate_of": None,
        "created_at": datetime.now(timezone.utc),
        "created_by": str(current_user["_id"]),
    }
    result = await db.bugs.insert_one(doc)
    bug_id = result.inserted_id

    # Compute embedding in background so the response returns immediately,
    # preventing duplicate submissions caused by apparent request timeouts.
    background_tasks.add_task(
        _compute_and_store_embedding, db, bug_id, f"{body.title} {body.description}"
    )

    doc["id"] = str(bug_id)
    doc.pop("_id", None)
    doc.pop("embedding", None)
    return doc


@router.get("")
async def list_bugs(
    project_id: str | None = None,
    status: str | None = None,
    current_user: dict = Depends(get_current_user),
):
    db = get_database()
    scope = await build_project_scope_query(db, current_user, project_id)
    query = {**scope}
    if status:
        query["status"] = status
    bugs = await db.bugs.find(query, {"embedding": 0}).to_list(None)
    return [_fmt(b) for b in bugs]


@router.get("/{bug_id}")
async def get_bug(bug_id: str, current_user: dict = Depends(get_current_user)):
    db = get_database()
    b = await assert_bug_access(db, current_user, bug_id)
    return _fmt(b)


@router.patch("/{bug_id}")
async def update_bug(
    bug_id: str, body: BugUpdate, current_user: dict = Depends(get_current_user)
):
    db = get_database()
    b = await assert_bug_access(db, current_user, bug_id)
    role = current_user.get("role")
    if role == "admin":
        pass
    elif role == "manager":
        project = await load_project(db, b["project_id"])
        if not project:
            raise HTTPException(404, "Project not found")
        await assert_manager_can_manage_project(current_user, project)
    elif role == "tester":
        if b.get("created_by") != str(current_user["_id"]):
            raise HTTPException(403, "Testers can edit only bugs they reported")
    else:
        raise HTTPException(403, "Only admin, project manager, or bug reporter tester can edit bugs")

    raw = body.model_dump(exclude_unset=True)

    update = {k: v for k, v in raw.items() if v is not None}
    if update:
        await db.bugs.update_one({"_id": ObjectId(bug_id)}, {"$set": update})

    # Recompute embedding if description changed
    new_desc = body.description or b.get("description", "")
    new_title = body.title or b.get("title", "")
    if body.description or body.title:
        await _compute_and_store_embedding(db, ObjectId(bug_id), f"{new_title} {new_desc}")

    updated = await db.bugs.find_one({"_id": ObjectId(bug_id)}, {"embedding": 0})
    return _fmt(updated)


@router.delete("/{bug_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_bug(bug_id: str, current_user: dict = Depends(get_current_user)):
    db = get_database()
    b = await assert_bug_access(db, current_user, bug_id)
    role = current_user.get("role")
    if role == "admin":
        pass
    elif role == "manager":
        project = await load_project(db, b["project_id"])
        if not project:
            raise HTTPException(404, "Project not found")
        await assert_manager_can_manage_project(current_user, project)
    elif role == "tester":
        if b.get("created_by") != str(current_user["_id"]):
            raise HTTPException(403, "Testers can delete only bugs they reported")
    else:
        raise HTTPException(403, "Only admin, project manager, or bug reporter tester can delete bugs")
    result = await db.bugs.delete_one({"_id": ObjectId(bug_id)})
    if result.deleted_count == 0:
        raise HTTPException(404, "Bug not found")


@router.post("/merge")
async def merge_bugs(
    body: BugMergeRequest,
    current_user: dict = Depends(require_roles("admin", "manager")),
):
    """
    Mark duplicate_bug_id as a duplicate of canonical_bug_id.
    The duplicate bug is closed and its duplicate_of field is set.
    """
    db = get_database()

    canonical = await db.bugs.find_one({"_id": ObjectId(body.canonical_bug_id)})
    if not canonical:
        raise HTTPException(404, "Canonical bug not found")

    duplicate = await db.bugs.find_one({"_id": ObjectId(body.duplicate_bug_id)})
    if not duplicate:
        raise HTTPException(404, "Duplicate bug not found")

    if canonical.get("project_id") != duplicate.get("project_id"):
        raise HTTPException(400, "Bugs must belong to the same project to merge")

    project = await assert_project_access(db, current_user, canonical["project_id"])
    await assert_manager_can_manage_project(current_user, project)

    if body.duplicate_bug_id == body.canonical_bug_id:
        raise HTTPException(400, "Cannot merge a bug with itself")

    # Merge unique content from the duplicate's description into the canonical bug.
    merged_description = _merge_descriptions(
        canonical.get("description", ""),
        duplicate.get("description", ""),
    )
    await db.bugs.update_one(
        {"_id": ObjectId(body.canonical_bug_id)},
        {"$set": {"description": merged_description}},
    )
    await _compute_and_store_embedding(
        db,
        ObjectId(body.canonical_bug_id),
        f"{canonical.get('title', '')} {merged_description}",
    )

    # Notify reporter before deleting the duplicate bug.
    reporter_id = duplicate.get("created_by")
    if reporter_id:
        await notify_user(
            reporter_id,
            f"Bug '{duplicate['title']}' was merged into '{canonical['title']}' and removed.",
            "bug",
        )

    # Delete the duplicate bug entirely.
    await db.bugs.delete_one({"_id": ObjectId(body.duplicate_bug_id)})

    return {"ok": True, "canonical_bug_id": body.canonical_bug_id}


@router.get("/{bug_id}/similar")
async def get_similar_bugs(bug_id: str, current_user: dict = Depends(get_current_user)):
    """Return similar bugs based on embedding cosine similarity."""
    db = get_database()
    from .ai_module import cosine_similarity

    bug = await assert_bug_access(db, current_user, bug_id)

    embedding = bug.get("embedding")
    if not embedding:
        return []

    threshold = 0.3  # Lower threshold for "similar" (vs duplicate)
    project_bugs = await db.bugs.find(
        {"project_id": bug["project_id"], "_id": {"$ne": ObjectId(bug_id)}}
    ).to_list(None)

    similar = []
    for b in project_bugs:
        emb = b.get("embedding")
        if not emb:
            continue
        score = cosine_similarity(embedding, emb)
        if score > threshold:
            b["id"] = str(b["_id"])
            del b["_id"]
            b.pop("embedding", None)
            b["similarity_score"] = round(score, 4)
            similar.append(b)

    similar.sort(key=lambda x: x["similarity_score"], reverse=True)
    return similar[:10]
