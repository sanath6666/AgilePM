import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { tasksApi, usersApi } from "../api/client";
import { useAuth } from "../App";

const STATUS_COLORS = {
  Backlog: "bg-slate-500/20 text-slate-200 border-slate-500/20",
  Todo: "bg-sky-500/15 text-sky-100 border-sky-500/25",
  "In Progress": "bg-amber-500/15 text-amber-100 border-amber-500/25",
  Review: "bg-violet-500/15 text-violet-100 border-violet-500/25",
  Done: "bg-emerald-500/15 text-emerald-100 border-emerald-500/25",
};

const PRIORITY_COLORS = (p) => {
  if (p >= 8) return "bg-rose-500/20 text-rose-200 border border-rose-500/25";
  if (p >= 5) return "bg-amber-500/20 text-amber-100 border border-amber-500/25";
  return "bg-ai-surface text-ai-subtle border border-ai-line";
};

export default function TaskDetails() {
  const { user } = useAuth();
  const { taskId } = useParams();
  const [task, setTask] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!taskId) return;
    setLoading(true);
    setError("");
    Promise.all([tasksApi.get(taskId), usersApi.list()])
      .then(([taskRes, usersRes]) => {
        const t = taskRes.data;
        setTask(t);
        setUsers(usersRes.data || []);
      })
      .catch((err) => setError(err.response?.data?.detail || "Could not load task details."))
      .finally(() => setLoading(false));
  }, [taskId]);

  if (loading) return <p className="text-sm text-ai-subtle">Loading task details…</p>;
  if (error) return <p className="text-sm text-rose-300">{error}</p>;
  if (!task) return <p className="text-sm text-ai-subtle">Task not found.</p>;

  const createdAt = task.created_at ? new Date(task.created_at).toLocaleString() : null;

  const today = new Date().toISOString().slice(0, 10);
  const isOverdue = task.deadline && task.deadline < today && task.status !== "Done";
  const assigneeName = task.assigned_to
    ? users.find((u) => u.id === task.assigned_to)?.name || task.assigned_to.slice(-6)
    : "Unassigned";
  const canManage = ["admin", "manager"].includes(user?.role);

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h2 className="ai-page-title">Task details</h2>
        <Link to="/kanban" className="ai-btn-ghost">
          Back to kanban
        </Link>
      </div>

      <div className="ai-card space-y-4 p-5">
        <div className="flex flex-wrap gap-2 text-xs">
          <span
            className={`rounded-lg border px-2 py-1 capitalize ${
              STATUS_COLORS[task.status] || "border-ai-line bg-ai-surface text-ai-subtle"
            }`}
          >
            {task.status}
          </span>
          <span className={`rounded-lg px-2 py-1 ${PRIORITY_COLORS(task.priority)}`}>
            Priority {task.priority}
          </span>
          {task.is_delayed && (
            <span className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-rose-200">
              Delayed
            </span>
          )}
          {isOverdue && !task.is_delayed && (
            <span className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-rose-200">
              Overdue
            </span>
          )}
        </div>

        <div>
          <p className="ai-label mb-1">Title</p>
          <p className="text-sm text-ai-ink">{task.title}</p>
        </div>

        <div>
          <p className="ai-label mb-1">Description</p>
          <p className="text-sm text-ai-subtle whitespace-pre-wrap">{task.description || "No description."}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="ai-label mb-1">Priority</p>
            <p className="text-ai-subtle">{task.priority}</p>
          </div>
          <div>
            <p className="ai-label mb-1">Deadline</p>
            <p className="text-ai-subtle">{task.deadline || "No deadline"}</p>
          </div>
          <div>
            <p className="ai-label mb-1">Assigned to</p>
            <p className="text-ai-subtle">{assigneeName}</p>
          </div>
          {createdAt && (
            <div className="col-span-2 rounded-xl border border-ai-line bg-ai-raised/60 px-3 py-2">
              <p className="text-ai-subtle">Created</p>
              <p className="mt-0.5 font-medium text-ai-ink">{createdAt}</p>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {canManage && (
            <Link to={`/tasks/${task.id}/edit`} className="ai-btn-primary">
              Edit task
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
