import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { tasksApi, usersApi } from "../api/client";
import { useAuth } from "../App";

const STATUSES = ["Backlog", "Todo", "In Progress", "Review", "Done"];

export default function TaskEdit() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [task, setTask] = useState(null);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({
    title: "",
    description: "",
    status: "Backlog",
    priority: 0,
    deadline: "",
    assigned_to: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    if (!taskId) return;
    setLoading(true);
    setError("");
    Promise.all([tasksApi.get(taskId), usersApi.list()])
      .then(([taskRes, usersRes]) => {
        const t = taskRes.data;
        setTask(t);
        setUsers(usersRes.data || []);
        setForm({
          title: t.title || "",
          description: t.description || "",
          status: t.status || "Backlog",
          priority: t.priority ?? 0,
          deadline: t.deadline || "",
          assigned_to: t.assigned_to || "",
        });
      })
      .catch((err) => setError(err.response?.data?.detail || "Could not load task."))
      .finally(() => setLoading(false));
  }, [taskId]);

  const canManage = ["admin", "manager"].includes(user?.role);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!task) return;
    setSaving(true);
    setError("");
    setSaveMessage("");
    try {
      const payload = {
        title: form.title,
        description: form.description,
        status: form.status,
        priority: Number(form.priority),
        deadline: form.deadline || null,
        assigned_to: form.assigned_to || null,
      };
      const res = await tasksApi.update(task.id, payload);
      setTask(res.data);
      setSaveMessage("Task updated.");
    } catch (err) {
      setError(err.response?.data?.detail || "Could not update task.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!task) return;
    if (!window.confirm(`Delete task "${task.title}"?`)) return;
    setDeleting(true);
    try {
      await tasksApi.delete(task.id);
      navigate("/kanban");
    } catch (err) {
      setError(err.response?.data?.detail || "Could not delete task.");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <p className="text-sm text-ai-subtle">Loading task editor…</p>;
  if (error && !task) return <p className="text-sm text-rose-300">{error}</p>;
  if (!task) return <p className="text-sm text-ai-subtle">Task not found.</p>;
  if (!canManage) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-rose-300">Only admins and managers can edit/delete tasks.</p>
        <Link to={`/tasks/${task.id}`} className="ai-btn-ghost inline-flex">
          Back to task details
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h2 className="ai-page-title">Edit task</h2>
        <Link to={`/tasks/${task.id}`} className="ai-btn-ghost">
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
          <label htmlFor="task-title-edit" className="ai-label mb-1">
            Title
          </label>
          <input
            id="task-title-edit"
            required
            className="ai-input"
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
          />
        </div>
        <div>
          <label htmlFor="task-desc-edit" className="ai-label mb-1">
            Description
          </label>
          <textarea
            id="task-desc-edit"
            rows={4}
            className="ai-input min-h-[120px]"
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <label htmlFor="task-status-edit" className="ai-label mb-1">
              Status
            </label>
            <select
              id="task-status-edit"
              className="ai-select"
              value={form.status}
              onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
            >
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="task-priority-edit" className="ai-label mb-1">
              Priority (0-10)
            </label>
            <input
              id="task-priority-edit"
              type="number"
              min={0}
              max={10}
              className="ai-input"
              value={form.priority}
              onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value }))}
            />
          </div>
          <div>
            <label htmlFor="task-deadline-edit" className="ai-label mb-1">
              Deadline
            </label>
            <input
              id="task-deadline-edit"
              type="date"
              className="ai-input"
              value={form.deadline}
              onChange={(e) => setForm((prev) => ({ ...prev, deadline: e.target.value }))}
            />
          </div>
          <div>
            <label htmlFor="task-assignee-edit" className="ai-label mb-1">
              Assign to
            </label>
            <select
              id="task-assignee-edit"
              className="ai-select"
              value={form.assigned_to}
              onChange={(e) => setForm((prev) => ({ ...prev, assigned_to: e.target.value }))}
            >
              <option value="">Unassigned</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
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
            {deleting ? "Deleting..." : "Delete task"}
          </button>
        </div>
      </form>
    </div>
  );
}
