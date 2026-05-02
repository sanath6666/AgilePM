import React, { useEffect, useState } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { projectsApi, tasksApi, usersApi } from "../api/client";
import { Link } from "react-router-dom";
import { useAuth } from "../App";

const STATUSES = ["Backlog", "Todo", "In Progress", "Review", "Done"];

const STATUS_COLORS = {
  Backlog: "bg-slate-500/20 text-slate-200 border-slate-500/20",
  Todo: "bg-sky-500/15 text-sky-100 border-sky-500/25",
  "In Progress": "bg-amber-500/15 text-amber-100 border-amber-500/25",
  Review: "bg-violet-500/15 text-violet-100 border-violet-500/25",
  Done: "bg-emerald-500/15 text-emerald-100 border-emerald-500/25",
};

const PRIORITY_BADGE = (p) => {
  if (p >= 8) return "bg-rose-500/20 text-rose-200 border border-rose-500/25";
  if (p >= 5) return "bg-amber-500/20 text-amber-100 border border-amber-500/25";
  return "bg-ai-surface text-ai-subtle border border-ai-line";
};

export default function Kanban() {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState("");
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    status: "Backlog",
    priority: 0,
    deadline: "",
    assigned_to: "",
  });
  const canCreateTask = ["admin", "manager"].includes(user?.role);

  useEffect(() => {
    Promise.all([projectsApi.list(), usersApi.list()])
      .then(([p, u]) => {
        setProjects(p.data);
        setUsers(u.data);
        if (p.data.length > 0) setProjectId(p.data[0].id);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!projectId) return;
    tasksApi.list({ project_id: projectId }).then((r) => setTasks(r.data));
  }, [projectId]);

  const tasksByStatus = STATUSES.reduce((acc, s) => {
    acc[s] = tasks.filter((t) => t.status === s);
    return acc;
  }, {});

  const onDragEnd = async (result) => {
    const { draggableId, destination } = result;
    if (!destination) return;
    const newStatus = destination.droppableId;
    setTasks((prev) =>
      prev.map((t) => (t.id === draggableId ? { ...t, status: newStatus } : t))
    );
    try {
      await tasksApi.update(draggableId, { status: newStatus });
    } catch {
      tasksApi.list({ project_id: projectId }).then((r) => setTasks(r.data));
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      project_id: projectId,
      priority: Number(form.priority),
      assigned_to: form.assigned_to || null,
      deadline: form.deadline || null,
    };
    await tasksApi.create(payload);
    setShowCreate(false);
    setForm({
      title: "",
      description: "",
      status: "Backlog",
      priority: 0,
      deadline: "",
      assigned_to: "",
    });
    tasksApi.list({ project_id: projectId }).then((r) => setTasks(r.data));
  };

  const userName = (uid) => users.find((u) => u.id === uid)?.name || uid?.slice(-6) || "";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="ai-page-title">Kanban</h2>
          <p className="ai-muted mt-1">Drag cards to update status — optimized for pointer and keyboard flows.</p>
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
          {canCreateTask && (
            <button type="button" onClick={() => setShowCreate(!showCreate)} className="ai-btn-primary">
              New task
            </button>
          )}
        </div>
      </div>

      {showCreate && canCreateTask && (
        <form
          onSubmit={handleCreate}
          className="ai-card grid max-w-2xl grid-cols-2 gap-3 p-5"
        >
          <div className="col-span-2">
            <label htmlFor="kb-title" className="ai-label">
              Title
            </label>
            <input
              id="kb-title"
              required
              className="ai-input"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div className="col-span-2">
            <label htmlFor="kb-desc" className="ai-label">
              Description
            </label>
            <textarea
              id="kb-desc"
              rows={2}
              className="ai-input min-h-[80px]"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="kb-status" className="ai-label">
              Status
            </label>
            <select
              id="kb-status"
              className="ai-select"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="kb-priority" className="ai-label">
              Priority (0–10)
            </label>
            <input
              id="kb-priority"
              type="number"
              min={0}
              max={10}
              className="ai-input"
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="kb-deadline" className="ai-label">
              Deadline
            </label>
            <input
              id="kb-deadline"
              type="date"
              className="ai-input"
              value={form.deadline}
              onChange={(e) => setForm({ ...form, deadline: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="kb-assign" className="ai-label">
              Assign to
            </label>
            <select
              id="kb-assign"
              className="ai-select"
              value={form.assigned_to}
              onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
            >
              <option value="">Unassigned</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-2 flex flex-wrap gap-2">
            <button type="submit" className="ai-btn-primary">
              Create task
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="ai-btn-ghost">
              Cancel
            </button>
          </div>
        </form>
      )}

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STATUSES.map((status) => (
            <div key={status} className="w-64 shrink-0">
              <div
                className={`rounded-t-xl border border-b-0 px-3 py-2.5 text-sm font-semibold ${STATUS_COLORS[status]}`}
              >
                {status}
                <span className="ml-2 text-xs font-normal opacity-70">
                  ({tasksByStatus[status].length})
                </span>
              </div>
              <Droppable droppableId={status}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`min-h-[220px] space-y-2 rounded-b-xl border border-t-0 border-ai-line p-2 transition-colors ${
                      snapshot.isDraggingOver ? "bg-cyan-500/10" : "bg-ai-void/50"
                    }`}
                  >
                    {tasksByStatus[status].map((task, index) => (
                      <Draggable key={task.id} draggableId={task.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`rounded-xl border border-ai-line bg-ai-raised/90 p-3 text-sm shadow-ai-inset transition ${
                              snapshot.isDragging
                                ? "ring-2 ring-cyan-400/50 shadow-ai-card"
                                : ""
                            } ${task.is_delayed ? "border-l-4 border-l-rose-400" : ""}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <Link
                                to={`/tasks/${task.id}`}
                                className="font-medium leading-snug text-ai-ink underline-offset-4 hover:underline"
                              >
                                {task.title}
                              </Link>
                            </div>
                            {task.description && (
                              <p className="mt-1 line-clamp-2 text-xs text-ai-subtle">{task.description}</p>
                            )}
                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                              <span
                                className={`rounded-md px-1.5 py-0.5 text-xs ${PRIORITY_BADGE(task.priority)}`}
                              >
                                P{task.priority}
                              </span>
                              {task.deadline && (
                                <span className="font-mono text-xs text-ai-subtle">{task.deadline}</span>
                              )}
                              {task.is_delayed && (
                                <span className="rounded-md bg-rose-500/20 px-1.5 py-0.5 text-xs text-rose-200">
                                  Delayed
                                </span>
                              )}
                              {task.assigned_to && (
                                <span className="rounded-md border border-cyan-500/20 bg-cyan-500/10 px-1.5 py-0.5 text-xs text-cyan-100">
                                  {userName(task.assigned_to)}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>
    </div>
  );
}
