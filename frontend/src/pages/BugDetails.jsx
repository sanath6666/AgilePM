import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { bugsApi } from "../api/client";
import { useAuth } from "../App";

const SEVERITY_COLORS = {
  low: "bg-emerald-500/15 text-emerald-200 border border-emerald-500/25",
  medium: "bg-amber-500/15 text-amber-100 border border-amber-500/25",
  high: "bg-orange-500/15 text-orange-100 border border-orange-500/25",
  critical: "bg-rose-500/15 text-rose-100 border border-rose-500/25",
};

const STATUS_COLORS = {
  open: "bg-sky-500/15 text-sky-100 border border-sky-500/25",
  "in-progress": "bg-violet-500/15 text-violet-100 border border-violet-500/25",
  resolved: "bg-emerald-500/15 text-emerald-100 border border-emerald-500/25",
  closed: "bg-ai-surface text-ai-subtle border border-ai-line",
};

export default function BugDetails() {
  const { user } = useAuth();
  const { bugId } = useParams();
  const [bug, setBug] = useState(null);
  const [similar, setSimilar] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!bugId) return;
    setLoading(true);
    setError("");
    bugsApi
      .get(bugId)
      .then((res) => {
        setBug(res.data);
        return bugsApi.similar(bugId);
      })
      .then((res) => setSimilar(res.data || []))
      .catch((err) => setError(err.response?.data?.detail || "Could not load bug details."))
      .finally(() => setLoading(false));
  }, [bugId]);

  if (loading) return <p className="text-sm text-ai-subtle">Loading bug details…</p>;
  if (error) return <p className="text-sm text-rose-300">{error}</p>;
  if (!bug) return <p className="text-sm text-ai-subtle">Bug not found.</p>;

  const createdAt = bug.created_at
    ? new Date(bug.created_at).toLocaleString()
    : null;
  const canManage = (() => {
    if (!user || !bug) return false;
    if (user.role === "admin" || user.role === "manager") return true;
    if (user.role === "tester") return bug.created_by === user.id;
    return false;
  })();

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h2 className="ai-page-title">Bug details</h2>
        <Link to="/bugs" className="ai-btn-ghost">
          Back to bugs
        </Link>
      </div>

      <div className="ai-card space-y-4 p-5">
        <div className="flex flex-wrap gap-2 text-xs">
          <span
            className={`rounded-lg px-2 py-1 capitalize ${
              SEVERITY_COLORS[bug.severity] || "border border-ai-line bg-ai-surface text-ai-subtle"
            }`}
          >
            {bug.severity}
          </span>
          <span
            className={`rounded-lg px-2 py-1 capitalize ${
              STATUS_COLORS[bug.status] || "border border-ai-line bg-ai-surface text-ai-subtle"
            }`}
          >
            {bug.status}
          </span>
          {bug.duplicate_of && (
            <span className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-amber-100">
              Duplicate of: {bug.duplicate_of}
            </span>
          )}
        </div>

        <div>
          <p className="ai-label mb-1">Title</p>
          <p className="text-sm text-ai-ink">{bug.title}</p>
        </div>

        <div>
          <p className="ai-label mb-1">Description</p>
          <p className="text-sm text-ai-subtle whitespace-pre-wrap">{bug.description}</p>
        </div>

        {createdAt && <p className="text-xs text-ai-subtle">Reported: {createdAt}</p>}

        <div className="flex flex-wrap gap-2">
          {canManage && (
            <Link to={`/bugs/${bug.id}/edit`} className="ai-btn-primary">
              Edit bug
            </Link>
          )}
        </div>
      </div>

      {similar.length > 0 && (
        <div className="ai-card space-y-3 p-5">
          <h4 className="text-sm font-semibold text-ai-ink">Similar bugs</h4>
          <div className="space-y-2">
            {similar.map((s) => (
              <div
                key={s.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-ai-line bg-ai-raised/60 px-3 py-2.5"
              >
                <div className="min-w-0 space-y-0.5">
                  <Link
                    to={`/bugs/${s.id}`}
                    className="text-sm font-medium text-ai-ink underline-offset-4 hover:underline"
                  >
                    {s.title}
                  </Link>
                  <p className="line-clamp-2 text-xs text-ai-subtle">{s.description}</p>
                </div>
                <span className="shrink-0 rounded-lg border border-ai-line bg-ai-surface px-2 py-0.5 font-mono text-xs text-ai-subtle">
                  {(s.similarity_score * 100).toFixed(0)}% match
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
