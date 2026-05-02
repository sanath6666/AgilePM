from __future__ import annotations
from typing import Any, Literal, Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field


# ── helpers ───────────────────────────────────────────────────────────────────

def _oid() -> str:
    """Return empty string as placeholder; real id comes from Mongo."""
    return ""


# ── Auth ──────────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "developer"  # admin | manager | developer | tester


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ── User ──────────────────────────────────────────────────────────────────────

class UserOut(BaseModel):
    id: str
    name: str
    email: str
    role: str


# ── Project ───────────────────────────────────────────────────────────────────

class ProjectCreate(BaseModel):
    name: str
    description: str = ""


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class MemberUpdate(BaseModel):
    user_id: str


# ── Task ──────────────────────────────────────────────────────────────────────

VALID_STATUSES = {"Backlog", "Todo", "In Progress", "Review", "Done"}


class TaskCreate(BaseModel):
    title: str
    description: str = ""
    status: str = "Backlog"
    priority: int = 0
    deadline: Optional[str] = None   # ISO date string YYYY-MM-DD
    assigned_to: Optional[str] = None
    project_id: str
    sprint_id: Optional[str] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[int] = None
    deadline: Optional[str] = None
    assigned_to: Optional[str] = None
    sprint_id: Optional[str] = None


# ── Bug ───────────────────────────────────────────────────────────────────────

class BugCreate(BaseModel):
    title: str
    description: str
    severity: str = "medium"   # low | medium | high | critical
    status: str = "open"
    task_id: Optional[str] = None
    project_id: str


class BugUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    severity: Optional[str] = None
    status: Optional[str] = None


class BugMergeRequest(BaseModel):
    duplicate_bug_id: str    # will be closed/marked
    canonical_bug_id: str    # the one that survives


# ── Sprint ────────────────────────────────────────────────────────────────────

class SprintCreate(BaseModel):
    name: str
    project_id: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    goal: Optional[str] = None


class SprintUpdate(BaseModel):
    name: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    goal: Optional[str] = None


# ── AI ────────────────────────────────────────────────────────────────────────

class DuplicateCheckRequest(BaseModel):
    description: str
    project_id: str
    title: Optional[str] = None
    exclude_bug_id: Optional[str] = None


class DuplicateCheckResponse(BaseModel):
    is_duplicate: bool
    similarity_score: Optional[float] = None
    matched_bug_id: Optional[str] = None
    matched_bug_title: Optional[str] = None


class BugEnhanceRequest(BaseModel):
    """Optional context from embedding duplicate check to enrich LLM guidance."""

    title: str
    description: str
    matched_bug_title: Optional[str] = None
    similarity_score: Optional[float] = None


class BugEnhanceResponse(BaseModel):
    summary: str
    suggested_severity: Literal["low", "medium", "high", "critical"]
    improved_title: str
    triage_bullets: str
    merge_guidance: Optional[str] = None


class DelayNarrativeRequest(BaseModel):
    """Compact stats from dashboard; LLM returns an executive-style paragraph."""

    delayed_count: int
    on_time_count: int
    sample_titles: list[str] = Field(default_factory=list)
    expected_completion_date: Optional[str] = None
    throughput_per_week: Optional[float] = None
    open_tasks: Optional[int] = None
    delay_risk_ratio: Optional[float] = None
    forecast_method: Optional[str] = None


class DelayNarrativeResponse(BaseModel):
    narrative: str
