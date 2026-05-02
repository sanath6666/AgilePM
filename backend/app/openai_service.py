"""
Optional OpenAI layer: natural-language triage and summaries on top of local embeddings.

Requires OPENAI_API_KEY. All calls use JSON mode for structured parsing.
"""
from __future__ import annotations

import json
import re
from typing import Any

from .config import settings
from .models.schemas import BugEnhanceRequest, BugEnhanceResponse, DelayNarrativeRequest, DelayNarrativeResponse


def openai_configured() -> bool:
    return bool(settings.OPENAI_API_KEY and settings.OPENAI_API_KEY.strip())


def _strip_json_fence(raw: str) -> str:
    text = raw.strip()
    m = re.match(r"^```(?:json)?\s*([\s\S]*?)\s*```$", text)
    if m:
        return m.group(1).strip()
    return text


def _coerce_severity(value: Any) -> str:
    s = str(value or "").lower().strip()
    if s in ("low", "medium", "high", "critical"):
        return s
    return "medium"


async def _chat_json(system: str, user: str) -> dict[str, Any]:
    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    resp = await client.chat.completions.create(
        model=settings.OPENAI_MODEL,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        response_format={"type": "json_object"},
        temperature=0.25,
        max_tokens=900,
    )
    raw = resp.choices[0].message.content or "{}"
    return json.loads(_strip_json_fence(raw))


async def enhance_bug_report(body: BugEnhanceRequest) -> BugEnhanceResponse:
    system = (
        "You are a senior QA engineer triaging bug reports for an agile team. "
        "Respond with ONLY a JSON object using these exact keys: "
        "summary (string, max 2 sentences), "
        "suggested_severity (one of: low, medium, high, critical), "
        "improved_title (string, concise, Title Case), "
        "triage_bullets (string, use newline-separated lines starting with '- ' for missing info or repro steps), "
        "merge_guidance (string; if duplicate context is provided, explain whether same root cause is plausible; else empty string)."
    )
    user_parts = [
        f"Title: {body.title}",
        f"Description:\n{body.description}",
    ]
    if body.matched_bug_title is not None:
        user_parts.append(f"Embedding match (possible duplicate): {body.matched_bug_title}")
    if body.similarity_score is not None:
        user_parts.append(f"Cosine similarity score (0-1): {body.similarity_score}")
    user = "\n\n".join(user_parts)

    data = await _chat_json(system, user)
    merge = data.get("merge_guidance")
    if isinstance(merge, str) and not merge.strip():
        merge = None

    return BugEnhanceResponse(
        summary=str(data.get("summary") or "").strip() or "No summary generated.",
        suggested_severity=_coerce_severity(data.get("suggested_severity")),
        improved_title=str(data.get("improved_title") or body.title).strip() or body.title,
        triage_bullets=str(data.get("triage_bullets") or "").strip() or "- None noted.",
        merge_guidance=merge.strip() if isinstance(merge, str) else None,
    )


async def narrate_delays(body: DelayNarrativeRequest) -> DelayNarrativeResponse:
    system = (
        "You are an engineering manager. Given task delay statistics, write ONE short paragraph (3-5 sentences) "
        "for a standup or status email: tone professional, mention risk without alarmism. "
        "If an expected completion date is provided, include that exact date in the narrative. "
        'Respond with JSON: {"narrative": "..."} only.'
    )
    titles = ", ".join(body.sample_titles[:10]) if body.sample_titles else "none listed"
    forecast_parts = []
    if body.expected_completion_date:
        forecast_parts.append(f"Expected completion date: {body.expected_completion_date}.")
    if body.throughput_per_week is not None:
        forecast_parts.append(f"Throughput: {body.throughput_per_week} done tasks/week.")
    if body.open_tasks is not None:
        forecast_parts.append(f"Open tasks remaining: {body.open_tasks}.")
    if body.delay_risk_ratio is not None:
        forecast_parts.append(f"Delay risk ratio: {body.delay_risk_ratio}.")
    if body.forecast_method:
        forecast_parts.append(f"Forecast method: {body.forecast_method}.")

    forecast_text = " ".join(forecast_parts) if forecast_parts else ""
    user = (
        f"Delayed tasks (past deadline, not Done): {body.delayed_count}. "
        f"On-time or done: {body.on_time_count}. "
        f"Example delayed titles: {titles}. "
        f"{forecast_text}"
    )
    data = await _chat_json(system, user)
    text = str(data.get("narrative") or "").strip()
    if not text:
        text = "No narrative could be generated."
    return DelayNarrativeResponse(narrative=text)


async def classify_duplicate(
    incoming_text: str,
    candidate_title: str,
    candidate_description: str,
    similarity_score: float,
) -> dict[str, Any]:
    system = (
        "You are a QA duplicate-triage assistant. "
        "Decide if two bug reports describe the same underlying issue. "
        "Respond only JSON with keys: is_duplicate (boolean), confidence (0-1 number), reason (short string)."
    )
    user = (
        f"Incoming bug report:\n{incoming_text}\n\n"
        f"Existing bug title: {candidate_title}\n"
        f"Existing bug description:\n{candidate_description}\n\n"
        f"Embedding cosine similarity: {similarity_score}"
    )
    data = await _chat_json(system, user)
    confidence_raw = data.get("confidence", 0)
    try:
        confidence = float(confidence_raw)
    except (TypeError, ValueError):
        confidence = 0.0
    confidence = max(0.0, min(confidence, 1.0))
    return {
        "is_duplicate": bool(data.get("is_duplicate", False)),
        "confidence": confidence,
        "reason": str(data.get("reason") or "").strip(),
    }
