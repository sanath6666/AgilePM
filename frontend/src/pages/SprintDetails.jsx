import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { sprintsApi } from "../api/client";
import { useAuth } from "../App";

export default function SprintDetails() {
  const { sprintId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sprint, setSprint] = useState(null);
  const [form, setForm] = useState({ name: "", start_date: "", end_date: "", goal: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    if (!sprintId) return;
    setLoading(true);
    setError("");
    sprintsApi
      .get(sprintId)
      .then((res) => {
        setSprint(res.data);
        setForm({
          name: res.data.name || "",
          start_date: res.data.start_date || "",
          end_date: res.data.end_date || "",
          goal: res.data.goal || "",
        });
      })
      .catch((err) => setError(err.response?.data?.detail || "Could not load sprint details."))
      .finally(() => setLoading(false));
  }, [sprintId]);

  const canManage = useMemo(() => ["admin", "manager"].includes(user?.role), [user]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!sprint) return;
    setSaving(true);
    setError("");
    setSaveMessage("");
    try {
      const res = await sprintsApi.update(sprint.id, form);
      setSprint(res.data);
      setSaveMessage("Sprint updated.");
    } catch (err) {
      setError(err.response?.data?.detail || "Could not update sprint.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!sprint) return;
    if (!window.confirm(`Delete sprint "${sprint.name}"?`)) return;
    setDeleting(true);
    try {
      await sprintsApi.delete(sprint.id);
      navigate("/sprint");
    } catch (err) {
      setError(err.response?.data?.detail || "Could not delete sprint.");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <p className="text-sm text-ai-subtle">Loading sprint details…</p>;
  if (error && !sprint) return <p className="text-sm text-rose-300">{error}</p>;
  if (!sprint) return <p className="text-sm text-ai-subtle">Sprint not found.</p>;

  if (!canManage) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-ai-subtle">Sprint details</p>
        <div className="ai-card space-y-2 p-4">
          <p className="font-medium text-ai-ink">{sprint.name}</p>
          {sprint.start_date && (
            <p className="text-xs text-ai-subtle">
              {sprint.start_date} - {sprint.end_date || "..."}
            </p>
          )}
          {sprint.goal && <p className="text-sm text-ai-subtle">{sprint.goal}</p>}
        </div>
        <Link to="/sprint" className="ai-btn-ghost inline-flex">
          Back to sprints
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="ai-page-title">Manage sprint</h2>
        <Link to="/sprint" className="ai-btn-ghost">
          Back to sprints
        </Link>
      </div>

      <form onSubmit={handleSave} className="ai-card space-y-4 p-5">
        {error && (
          <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {error}
          </p>
        )}
        {saveMessage && (
          <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
            {saveMessage}
          </p>
        )}

        <div>
          <label htmlFor="sprint-name" className="ai-label mb-1">
            Sprint name
          </label>
          <input
            id="sprint-name"
            required
            className="ai-input"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="sprint-start" className="ai-label mb-1">
              Start date
            </label>
            <input
              id="sprint-start"
              type="date"
              className="ai-input"
              value={form.start_date}
              onChange={(e) => setForm((prev) => ({ ...prev, start_date: e.target.value }))}
            />
          </div>
          <div>
            <label htmlFor="sprint-end" className="ai-label mb-1">
              End date
            </label>
            <input
              id="sprint-end"
              type="date"
              className="ai-input"
              value={form.end_date}
              onChange={(e) => setForm((prev) => ({ ...prev, end_date: e.target.value }))}
            />
          </div>
        </div>

        <div>
          <label htmlFor="sprint-goal" className="ai-label mb-1">
            Goal
          </label>
          <textarea
            id="sprint-goal"
            rows={3}
            className="ai-input min-h-[96px]"
            value={form.goal}
            onChange={(e) => setForm((prev) => ({ ...prev, goal: e.target.value }))}
          />
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
            {deleting ? "Deleting..." : "Delete sprint"}
          </button>
        </div>
      </form>
    </div>
  );
}
