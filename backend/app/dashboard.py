"""
Dashboard aggregation endpoints.
Provides:
  GET /dashboard/summary?project_id=   – task counts by status, bug counts by severity/status
  GET /dashboard/delay-analytics?project_id= – delayed task stats + trend by creation month
"""
from datetime import date, timedelta
import math

from fastapi import APIRouter, Depends

from .access import assert_project_access, is_admin, member_project_ids
from .dependencies import get_current_user
from .database import get_database

router = APIRouter()


def _build_delay_forecast(tasks: list[dict], delayed_count: int, on_time_count: int) -> dict:
    """
    Industry-style delivery estimate using:
      1) Throughput (done items per week)
      2) Little's Law proxy (ETA ~= WIP / throughput)
      3) Delay-risk buffer (from delayed ratio)
    """
    today = date.today()
    done_tasks = [t for t in tasks if t.get("status") == "Done"]
    open_tasks = [t for t in tasks if t.get("status") != "Done"]
    open_count = len(open_tasks)

    # Primary velocity signal: trailing 28-day throughput.
    trailing_days = 28
    cutoff = today - timedelta(days=trailing_days)
    done_trailing = 0
    for t in done_tasks:
        created_at = t.get("created_at")
        if not created_at:
            continue
        try:
            if created_at.date() >= cutoff:
                done_trailing += 1
        except Exception:
            continue

    throughput_per_week = done_trailing / 4 if done_trailing > 0 else 0.0

    # Fallback: all-time throughput across project lifespan.
    if throughput_per_week <= 0:
        created_dates = []
        for t in tasks:
            created_at = t.get("created_at")
            try:
                if created_at:
                    created_dates.append(created_at.date())
            except Exception:
                continue
        if created_dates:
            project_age_days = max((today - min(created_dates)).days, 7)
            throughput_per_week = max((len(done_tasks) / project_age_days) * 7, 0.1)
        else:
            throughput_per_week = 0.1

    eta_weeks = open_count / throughput_per_week if throughput_per_week > 0 else 0.0
    eta_days_baseline = max(math.ceil(eta_weeks * 7), 0)

    total_observed = delayed_count + on_time_count
    delay_risk_ratio = (delayed_count / total_observed) if total_observed > 0 else 0.0
    risk_buffer_multiplier = 1.0 + min(delay_risk_ratio, 0.5)
    eta_days_risk_adjusted = max(math.ceil(eta_days_baseline * risk_buffer_multiplier), 0)
    expected_completion_date = (today + timedelta(days=eta_days_risk_adjusted)).isoformat()

    return {
        "open_tasks": open_count,
        "throughput_per_week": round(throughput_per_week, 2),
        "eta_days_baseline": eta_days_baseline,
        "delay_risk_ratio": round(delay_risk_ratio, 4),
        "risk_buffer_multiplier": round(risk_buffer_multiplier, 3),
        "eta_days_risk_adjusted": eta_days_risk_adjusted,
        "expected_completion_date": expected_completion_date,
        "method": "Throughput + Little's Law proxy + delay-risk buffer",
    }


async def _scoped_match(db, current_user: dict, project_id: str | None) -> dict:
    if project_id:
        await assert_project_access(db, current_user, project_id)
        return {"project_id": project_id}
    if is_admin(current_user):
        return {}
    ids = await member_project_ids(db, current_user)
    if not ids:
        return {"project_id": {"$in": []}}
    return {"project_id": {"$in": ids}}


@router.get("/summary")
async def dashboard_summary(
    project_id: str | None = None,
    current_user: dict = Depends(get_current_user),
):
    db = get_database()
    scope = await _scoped_match(db, current_user, project_id)
    task_match = dict(scope)
    bug_match = dict(scope)

    # Task counts by status
    task_pipeline = [
        {"$match": task_match},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}},
    ]
    task_results = await db.tasks.aggregate(task_pipeline).to_list(None)
    tasks_by_status = {r["_id"]: r["count"] for r in task_results}

    # Bug counts by severity
    bug_severity_pipeline = [
        {"$match": bug_match},
        {"$group": {"_id": "$severity", "count": {"$sum": 1}}},
    ]
    bug_severity_results = await db.bugs.aggregate(bug_severity_pipeline).to_list(None)
    bugs_by_severity = {r["_id"]: r["count"] for r in bug_severity_results}

    # Bug counts by status
    bug_status_pipeline = [
        {"$match": bug_match},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}},
    ]
    bug_status_results = await db.bugs.aggregate(bug_status_pipeline).to_list(None)
    bugs_by_status = {r["_id"]: r["count"] for r in bug_status_results}

    # Delayed tasks count
    today_str = date.today().isoformat()
    delayed_match = {
        **task_match,
        "deadline": {"$lt": today_str, "$exists": True, "$ne": None},
        "status": {"$ne": "Done"},
    }
    delayed_count = await db.tasks.count_documents(delayed_match)
    total_tasks = await db.tasks.count_documents(task_match)
    total_bugs = await db.bugs.count_documents(bug_match)

    return {
        "total_tasks": total_tasks,
        "total_bugs": total_bugs,
        "delayed_tasks": delayed_count,
        "tasks_by_status": tasks_by_status,
        "bugs_by_severity": bugs_by_severity,
        "bugs_by_status": bugs_by_status,
    }


@router.get("/delay-analytics")
async def delay_analytics(
    project_id: str | None = None,
    current_user: dict = Depends(get_current_user),
):
    db = get_database()
    today_str = date.today().isoformat()

    base_match: dict = await _scoped_match(db, current_user, project_id)

    # On-time vs delayed
    delayed_match = {
        **base_match,
        "deadline": {"$lt": today_str, "$exists": True, "$ne": None},
        "status": {"$ne": "Done"},
    }
    on_time_match = {
        **base_match,
        "$or": [
            {"deadline": {"$gte": today_str}},
            {"status": "Done"},
            {"deadline": None},
        ],
    }

    delayed_count = await db.tasks.count_documents(delayed_match)
    on_time_count = await db.tasks.count_documents(on_time_match)
    scoped_tasks = await db.tasks.find(base_match, {"status": 1, "created_at": 1}).to_list(None)
    forecast = _build_delay_forecast(scoped_tasks, delayed_count, on_time_count)

    # Sample delayed tasks (up to 10)
    delayed_tasks = await db.tasks.find(
        delayed_match, {"_id": 1, "title": 1, "deadline": 1, "priority": 1, "status": 1}
    ).limit(10).to_list(None)
    for t in delayed_tasks:
        t["id"] = str(t["_id"])
        del t["_id"]

    # Monthly task creation trend (last 6 months)
    trend_pipeline = [
        {"$match": {**base_match, "created_at": {"$exists": True}}},
        {
            "$group": {
                "_id": {
                    "year": {"$year": "$created_at"},
                    "month": {"$month": "$created_at"},
                },
                "count": {"$sum": 1},
            }
        },
        {"$sort": {"_id.year": 1, "_id.month": 1}},
        {"$limit": 6},
    ]
    trend_results = await db.tasks.aggregate(trend_pipeline).to_list(None)
    trend = [
        {
            "month": f"{r['_id']['year']}-{r['_id']['month']:02d}",
            "tasks_created": r["count"],
        }
        for r in trend_results
    ]

    return {
        "delayed_count": delayed_count,
        "on_time_count": on_time_count,
        "sample_delayed_tasks": delayed_tasks,
        "monthly_trend": trend,
        "forecast": forecast,
    }
