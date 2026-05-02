"""
AI module: Sentence-BERT duplicate detection.

Loads the bundled bug-duplicate SBERT by default (backend/sbert-bug-duplicates),
or SBERT_MODEL_PATH. First load can take a few seconds to read weights from disk.
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
from pathlib import Path

import numpy as np
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from .config import settings
from .access import assert_project_access
from .database import get_database
from .dependencies import get_current_user
from .models.schemas import (
    BugEnhanceRequest,
    BugEnhanceResponse,
    DelayNarrativeRequest,
    DelayNarrativeResponse,
    DuplicateCheckRequest,
    DuplicateCheckResponse,
)
from . import openai_service

logger = logging.getLogger(__name__)

router = APIRouter()

# ── Model singleton ───────────────────────────────────────────────────────────

_model = None

_BACKEND_ROOT = Path(__file__).resolve().parent.parent
_DEFAULT_BUG_SBERT = _BACKEND_ROOT / "sbert-bug-duplicates"


def resolve_sbert_model_path() -> str:
    raw = (settings.SBERT_MODEL_PATH or "").strip()
    if raw:
        p = Path(raw)
        if not p.is_absolute():
            p = _BACKEND_ROOT / p
        return str(p.resolve())
    return str(_DEFAULT_BUG_SBERT.resolve())


def get_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer

        path = resolve_sbert_model_path()
        if not Path(path).exists():
            raise FileNotFoundError(
                f"SBERT model not found at {path}. "
                "Ensure backend/sbert-bug-duplicates is present or set SBERT_MODEL_PATH."
            )
        logger.info("Loading SentenceTransformer from %s", path)
        _model = SentenceTransformer(path)
    return _model


def encode(text: str) -> list[float]:
    """Encode text to a 384-dim embedding vector."""
    model = get_model()
    # Run in thread pool to avoid blocking the event loop
    embedding = model.encode(text, normalize_embeddings=True)
    return embedding.tolist()


def cosine_similarity(a: list[float], b: list[float]) -> float:
    va = np.array(a, dtype=np.float32)
    vb = np.array(b, dtype=np.float32)
    denom = np.linalg.norm(va) * np.linalg.norm(vb)
    if denom == 0:
        return 0.0
    return float(np.dot(va, vb) / denom)


def _normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip().lower())


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.post("/check-duplicate", response_model=DuplicateCheckResponse)
async def check_duplicate(
    body: DuplicateCheckRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Encode the provided description and compare against all bugs in the same
    project. Returns is_duplicate=True if max cosine similarity > threshold.
    """
    db = get_database()
    await assert_project_access(db, current_user, body.project_id)

    # Fetch all bugs in project; backfill missing embeddings on the fly.
    query: dict = {"project_id": body.project_id}
    if body.exclude_bug_id:
        query["_id"] = {"$ne": ObjectId(body.exclude_bug_id)}

    bugs = await db.bugs.find(query, {"_id": 1, "title": 1, "description": 1, "embedding": 1}).to_list(None)

    if not bugs:
        return DuplicateCheckResponse(is_duplicate=False)

    # Encode in thread pool to avoid blocking async loop.
    # Mirror the storage encoding (title + description) so similarity scores are meaningful.
    query_text = f"{body.title} {body.description}".strip() if body.title else body.description
    loop = asyncio.get_event_loop()
    query_embedding = await loop.run_in_executor(None, encode, query_text)

    normalized_query = _normalize_text(body.description)
    best_score = 0.0
    best_bug_id = None
    best_bug_title = None
    best_bug_description = None

    for bug in bugs:
        existing_description = bug.get("description", "")
        if _normalize_text(existing_description) == normalized_query:
            return DuplicateCheckResponse(
                is_duplicate=True,
                similarity_score=1.0,
                matched_bug_id=str(bug["_id"]),
                matched_bug_title=bug.get("title"),
            )
        emb = bug.get("embedding")
        if not emb:
            bug_text = f"{bug.get('title', '')} {bug.get('description', '')}".strip()
            if not bug_text:
                continue
            emb = await loop.run_in_executor(None, encode, bug_text)
            await db.bugs.update_one({"_id": bug["_id"]}, {"$set": {"embedding": emb}})
        score = cosine_similarity(query_embedding, emb)
        if score > best_score:
            best_score = score
            best_bug_id = str(bug["_id"])
            best_bug_title = bug.get("title")
            best_bug_description = existing_description

    threshold = settings.DUPLICATE_THRESHOLD
    if best_score > threshold:
        return DuplicateCheckResponse(
            is_duplicate=True,
            similarity_score=round(best_score, 4),
            matched_bug_id=best_bug_id,
            matched_bug_title=best_bug_title,
        )

    # Optional semantic fallback with OpenAI near the threshold.
    if (
        openai_service.openai_configured()
        and best_bug_id
        and best_bug_description is not None
        and best_score >= max(0.2, threshold - 0.2)
    ):
        try:
            llm_result = await openai_service.classify_duplicate(
                incoming_text=body.description,
                candidate_title=best_bug_title or "",
                candidate_description=best_bug_description,
                similarity_score=round(best_score, 4),
            )
            if llm_result.get("is_duplicate") and llm_result.get("confidence", 0) >= 0.65:
                return DuplicateCheckResponse(
                    is_duplicate=True,
                    similarity_score=round(best_score, 4),
                    matched_bug_id=best_bug_id,
                    matched_bug_title=best_bug_title,
                )
        except Exception:
            logger.exception("OpenAI duplicate classification failed")

    return DuplicateCheckResponse(is_duplicate=False, similarity_score=round(best_score, 4))


# ── OpenAI layer (optional) ───────────────────────────────────────────────────


@router.post("/enhance-bug", response_model=BugEnhanceResponse)
async def enhance_bug(
    body: BugEnhanceRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    LLM-assisted triage: summary, severity hint, cleaner title, checklist gaps,
    and optional merge guidance when embedding duplicate context is supplied.
    """
    if not openai_service.openai_configured():
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OpenAI is not configured. Set OPENAI_API_KEY in the backend environment.",
        )
    try:
        return await openai_service.enhance_bug_report(body)
    except json.JSONDecodeError:
        logger.exception("OpenAI JSON parse failed for enhance-bug")
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            detail="Could not parse language model response.",
        )
    except Exception:
        logger.exception("OpenAI enhance-bug failed")
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            detail="Language model request failed. Check API key, quota, and model name.",
        )


@router.post("/narrate-delays", response_model=DelayNarrativeResponse)
async def narrate_delays(
    body: DelayNarrativeRequest,
    current_user: dict = Depends(get_current_user),
):
    """Turn delay counts into a short manager-ready paragraph (optional OpenAI)."""
    if not openai_service.openai_configured():
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OpenAI is not configured. Set OPENAI_API_KEY in the backend environment.",
        )
    try:
        return await openai_service.narrate_delays(body)
    except json.JSONDecodeError:
        logger.exception("OpenAI JSON parse failed for narrate-delays")
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            detail="Could not parse language model response.",
        )
    except Exception:
        logger.exception("OpenAI narrate-delays failed")
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            detail="Language model request failed. Check API key, quota, and model name.",
        )
