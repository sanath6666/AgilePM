import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { bugsApi } from "../api/client";
import { useAuth } from "../App";

export default function BugEdit() {
  const { bugId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [bug, setBug] = useState(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    severity: "medium",
    status: "open",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    if (!bugId) return;
    setLoading(true);
    setError("");
    bugsApi
      .get(bugId)
      .then((res) => {
        setBug(res.data);
        setForm({
          title: res.data.title || "",
          description: res.data.description || "",
          severity: res.data.severity || "medium",
          status: res.data.status || "open",
        });
      })
      .catch((err) => setError(err.response?.data?.detail || "Could not load bug for editing."))
      .finally(() => setLoading(false));
  }, [bugId]);

  const canManage = (() => {
    if (!user || !bug) return false;
    if (user.role === "admin" || user.role === "manager") return true;
    if (user.role === "tester") return bug.created_by === user.id;
    return false;
  })();

  const handleSave = async (e) => {
    e.preventDefault();
    if (!bug) return;
    setSaving(true);
    setError("");
    setSaveMessage("");
    try {
      const res = await bugsApi.update(bug.id, form);
      setBug(res.data);
      setSaveMessage("Bug updated.");
    } catch (err) {
      setError(err.response?.data?.detail || "Could not update bug.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!bug) return;
    if (!window.confirm(`Delete bug "${bug.title}"?`)) return;
    setDeleting(true);
    try {
      await bugsApi.delete(bug.id);
      navigate("/bugs");
    } catch (err) {
      setError(err.response?.data?.detail || "Could not delete bug.");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <p className="text-sm text-ai-subtle">Loading bug editor…</p>;
  if (error && !bug) return <p className="text-sm text-rose-300">{error}</p>;
  if (!bug) return <p className="text-sm text-ai-subtle">Bug not found.</p>;
  if (!canManage) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-rose-300">You do not have permission to edit/delete this bug.</p>
        <Link to={`/bugs/${bug.id}`} className="ai-btn-ghost inline-flex">
          Back to bug details
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h2 className="ai-page-title">Edit bug</h2>
        <Link to={`/bugs/${bug.id}`} className="ai-btn-ghost">
          Back to details
        </Link>
      </div>
      <form onSubmit={handleSave} className="ai-card space-y-4 p-5">
        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
            {error}
          </div>
        )}
        {saveMessage && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
            {saveMessage}
          </div>
        )}
        <div>
          <label htmlFor="bug-title-edit" className="ai-label mb-1">
            Title
          </label>
          <input
            id="bug-title-edit"
            required
            className="ai-input"
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
          />
        </div>
        <div>
          <label htmlFor="bug-desc-edit" className="ai-label mb-1">
            Description
          </label>
          <textarea
            id="bug-desc-edit"
            required
            rows={4}
            className="ai-input min-h-[120px]"
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="bug-severity-edit" className="ai-label mb-1">
              Severity
            </label>
            <select
              id="bug-severity-edit"
              className="ai-select"
              value={form.severity}
              onChange={(e) => setForm((prev) => ({ ...prev, severity: e.target.value }))}
            >
              {["low", "medium", "high", "critical"].map((severity) => (
                <option key={severity} value={severity}>
                  {severity}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="bug-status-edit" className="ai-label mb-1">
              Status
            </label>
            <select
              id="bug-status-edit"
              className="ai-select"
              value={form.status}
              onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
            >
              {["open", "in-progress", "resolved", "closed"].map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={saving} className="ai-btn-primary disabled:opacity-60">
            {saving ? "Saving..." : "Save changes"}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-200 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {deleting ? "Deleting..." : "Delete bug"}
          </button>
        </div>
      </form>
    </div>
  );
}
