import React, { useEffect, useState } from "react";
import { aiApi, bugsApi, projectsApi } from "../api/client";
import { useAuth } from "../App";
import { Link } from "react-router-dom";

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

export default function BugTracker() {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState("");
  const [bugs, setBugs] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", severity: "medium" });
  const [dupWarning, setDupWarning] = useState(null);
  const [dupChecking, setDupChecking] = useState(false);
  const [mergeForm, setMergeForm] = useState({ duplicate_bug_id: "", canonical_bug_id: "" });
  const [showMerge, setShowMerge] = useState(false);
  const [enhanceLoading, setEnhanceLoading] = useState(false);
  const [enhanceResult, setEnhanceResult] = useState(null);
  const [enhanceError, setEnhanceError] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");
  const canMerge = ["admin", "manager"].includes(user?.role);

  useEffect(() => {
    projectsApi.list().then((r) => {
      setProjects(r.data);
      if (r.data.length > 0) setProjectId(r.data[0].id);
    });
  }, []);

  useEffect(() => {
    if (!projectId) return;
    bugsApi.list({ project_id: projectId }).then((r) => setBugs(r.data));
  }, [projectId]);

  const loadBugs = () =>
    bugsApi.list({ project_id: projectId }).then((r) => setBugs(r.data));

  const handleCheckDuplicate = async () => {
    if (!form.description.trim() || !projectId) return;
    setDupChecking(true);
    setDupWarning(null);
    try {
      const res = await aiApi.checkDuplicate({
        title: form.title,
        description: form.description,
        project_id: projectId,
      });
      if (res.data.is_duplicate) {
        setDupWarning(res.data);
      } else {
        setDupWarning({ is_duplicate: false });
      }
    } catch {
      // ignore
    } finally {
      setDupChecking(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (createLoading) return;
    setCreateLoading(true);
    setCreateError("");
    try {
      const created = await bugsApi.create({ ...form, project_id: projectId });
      setBugs((prev) => [created.data, ...prev.filter((b) => b.id !== created.data.id)]);
      setForm({ title: "", description: "", severity: "medium" });
      setDupWarning(null);
      setShowCreate(false);
      await loadBugs();
    } catch (err) {
      setCreateError(err.response?.data?.detail || "Could not create bug. Please try again.");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleMerge = async (e) => {
    e.preventDefault();
    try {
      await bugsApi.merge(mergeForm);
      setMergeForm({ duplicate_bug_id: "", canonical_bug_id: "" });
      setShowMerge(false);
      loadBugs();
    } catch (err) {
      alert(err.response?.data?.detail || "Merge failed");
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this bug?")) return;
    await bugsApi.delete(id);
    loadBugs();
  };

  const handleEnhanceGPT = async () => {
    if (!form.title.trim() || !form.description.trim()) return;
    setEnhanceLoading(true);
    setEnhanceResult(null);
    setEnhanceError("");
    try {
      const payload = {
        title: form.title,
        description: form.description,
      };
      if (dupWarning?.is_duplicate && dupWarning.matched_bug_title) {
        payload.matched_bug_title = dupWarning.matched_bug_title;
        if (dupWarning.similarity_score != null) {
          payload.similarity_score = dupWarning.similarity_score;
        }
      }
      const res = await aiApi.enhanceBug(payload);
      setEnhanceResult(res.data);
    } catch (err) {
      const d = err.response?.data?.detail;
      setEnhanceError(typeof d === "string" ? d : "Could not run GPT enhancement.");
    } finally {
      setEnhanceLoading(false);
    }
  };

  const closeCreate = () => {
    setShowCreate(false);
    setDupWarning(null);
    setEnhanceResult(null);
    setEnhanceError("");
    setCreateError("");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="ai-page-title">Bug tracker</h2>
          <p className="ai-muted mt-1">
            AI-assisted duplicate checks before you file — merge duplicates when you are ready.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            className="ai-select w-auto min-w-[160px]"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            aria-label="Select project"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => setShowCreate(!showCreate)} className="ai-btn-primary">
            Report bug
          </button>
          {canMerge && (
            <button
              type="button"
              onClick={() => setShowMerge(!showMerge)}
              className="ai-btn-secondary border-amber-500/30 bg-amber-500/10 text-amber-100 hover:border-amber-400/40"
            >
              Merge duplicates
            </button>
          )}
        </div>
      </div>

      {showCreate && (
        <div className="ai-card max-w-xl space-y-4 p-5">
          <h3 className="font-semibold text-ai-ink">Report a bug</h3>

          {dupWarning !== null && (
            <div
              className={`rounded-xl border px-3 py-3 text-sm ${
                dupWarning.is_duplicate
                  ? "border-amber-500/35 bg-amber-500/10 text-amber-100"
                  : "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
              }`}
              role="status"
            >
              {dupWarning.is_duplicate ? (
                <>
                  <strong>Possible duplicate</strong> (similarity:{" "}
                  {(dupWarning.similarity_score * 100).toFixed(1)}%)
                  {dupWarning.matched_bug_title && (
                    <>
                      {" "}
                      — matches “<em>{dupWarning.matched_bug_title}</em>”
                    </>
                  )}
                  . You may still submit; managers can merge later.
                </>
              ) : (
                "No duplicate found — looks unique."
              )}
            </div>
          )}

          {enhanceError && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
              {enhanceError}
            </div>
          )}
          {createError && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
              {createError}
            </div>
          )}

          {enhanceResult && (
            <div
              className="space-y-3 rounded-xl border border-cyan-500/25 bg-cyan-500/5 p-4 text-sm"
              role="region"
              aria-label="GPT triage suggestions"
            >
              <p className="font-mono text-[10px] uppercase tracking-wider text-cyan-400/90">
                GPT layer (local embeddings still drive duplicate score)
              </p>
              <p className="text-ai-ink">{enhanceResult.summary}</p>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-lg border border-ai-line px-2 py-1 text-xs text-ai-subtle">
                  Suggested severity:{" "}
                  <strong className="text-ai-ink">{enhanceResult.suggested_severity}</strong>
                </span>
                <button
                  type="button"
                  className="ai-btn-secondary py-1.5 text-xs"
                  onClick={() =>
                    setForm((f) => ({ ...f, severity: enhanceResult.suggested_severity }))
                  }
                >
                  Apply severity
                </button>
                <button
                  type="button"
                  className="ai-btn-secondary py-1.5 text-xs"
                  onClick={() => setForm((f) => ({ ...f, title: enhanceResult.improved_title }))}
                >
                  Apply title
                </button>
              </div>
              <div className="whitespace-pre-wrap text-xs text-ai-subtle">{enhanceResult.triage_bullets}</div>
              {enhanceResult.merge_guidance && (
                <p className="border-t border-ai-line pt-2 text-xs text-violet-200">
                  <strong>Merge guidance:</strong> {enhanceResult.merge_guidance}
                </p>
              )}
            </div>
          )}

          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label htmlFor="bug-title" className="ai-label">
                Title
              </label>
              <input
                id="bug-title"
                required
                className="ai-input"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="bug-desc" className="ai-label">
                Description
              </label>
              <textarea
                id="bug-desc"
                required
                rows={3}
                className="ai-input min-h-[100px]"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="bug-sev" className="ai-label">
                Severity
              </label>
              <select
                id="bug-sev"
                className="ai-select"
                value={form.severity}
                onChange={(e) => setForm({ ...form, severity: e.target.value })}
              >
                {["low", "medium", "high", "critical"].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleCheckDuplicate}
                disabled={dupChecking}
                className="ai-btn-secondary border-violet-500/30 bg-violet-500/10 text-violet-100 disabled:opacity-50"
              >
                {dupChecking ? "Checking…" : "Check duplicate (embeddings)"}
              </button>
              <button
                type="button"
                onClick={handleEnhanceGPT}
                disabled={enhanceLoading}
                className="ai-btn-secondary border-cyan-500/30 bg-cyan-500/10 text-cyan-100 disabled:opacity-50"
              >
                {enhanceLoading ? "GPT…" : "Enhance with GPT"}
              </button>
              <button type="submit" disabled={createLoading} className="ai-btn-primary disabled:opacity-60">
                {createLoading ? "Submitting..." : "Submit bug"}
              </button>
              <button type="button" onClick={closeCreate} className="ai-btn-ghost">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {showMerge && canMerge && (
        <form onSubmit={handleMerge} className="ai-card max-w-xl space-y-4 p-5">
          <h3 className="font-semibold text-ai-ink">Merge duplicate bug</h3>
          <div>
            <label htmlFor="merge-dup" className="ai-label">
              Duplicate bug (to close)
            </label>
            <select
              id="merge-dup"
              required
              className="ai-select"
              value={mergeForm.duplicate_bug_id}
              onChange={(e) => setMergeForm({ ...mergeForm, duplicate_bug_id: e.target.value })}
            >
              <option value="">Select duplicate…</option>
              {bugs
                .filter((b) => b.status !== "closed")
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label htmlFor="merge-can" className="ai-label">
              Canonical bug (to keep)
            </label>
            <select
              id="merge-can"
              required
              className="ai-select"
              value={mergeForm.canonical_bug_id}
              onChange={(e) => setMergeForm({ ...mergeForm, canonical_bug_id: e.target.value })}
            >
              <option value="">Select canonical…</option>
              {bugs
                .filter((b) => b.id !== mergeForm.duplicate_bug_id)
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title}
                  </option>
                ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="ai-btn-primary bg-gradient-to-r from-amber-500 to-orange-500">
              Merge
            </button>
            <button type="button" onClick={() => setShowMerge(false)} className="ai-btn-ghost">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {bugs.length === 0 && <p className="text-sm text-ai-subtle">No bugs reported yet.</p>}
        {bugs.map((b) => (
          <div
            key={b.id}
            className={`ai-card flex items-start justify-between gap-3 p-4 ${
              b.duplicate_of ? "border-l-4 border-l-ai-subtle opacity-75" : ""
            }`}
          >
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link to={`/bugs/${b.id}`} className="font-medium text-ai-ink underline-offset-4 hover:underline">
                  {b.title}
                </Link>
                <span
                  className={`rounded-lg px-2 py-0.5 text-xs capitalize ${
                    SEVERITY_COLORS[b.severity] || "border border-ai-line bg-ai-surface text-ai-subtle"
                  }`}
                >
                  {b.severity}
                </span>
                <span
                  className={`rounded-lg px-2 py-0.5 text-xs capitalize ${
                    STATUS_COLORS[b.status] || "border border-ai-line bg-ai-surface text-ai-subtle"
                  }`}
                >
                  {b.status}
                </span>
                {b.duplicate_of && (
                  <span className="rounded-lg border border-ai-line bg-ai-surface px-2 py-0.5 text-xs text-ai-subtle">
                    Duplicate
                  </span>
                )}
              </div>
              <p className="text-sm text-ai-subtle">{b.description}</p>
            </div>
            <button
              type="button"
              onClick={() => handleDelete(b.id)}
              className="shrink-0 rounded-lg px-2 py-1 text-xs text-ai-subtle hover:bg-rose-500/15 hover:text-rose-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/40"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
