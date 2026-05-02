import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { projectsApi, sprintsApi, tasksApi } from "../api/client";
import { useAuth } from "../App";

export default function Sprint() {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState("");
  const [sprints, setSprints] = useState([]);
  const [selectedSprint, setSelectedSprint] = useState(null);
  const [sprintTasks, setSprintTasks] = useState([]);
  const [allTasks, setAllTasks] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", start_date: "", end_date: "", goal: "" });
  const canManage = ["admin", "manager"].includes(user?.role);

  useEffect(() => {
    projectsApi.list().then((r) => {
      setProjects(r.data);
      if (r.data.length > 0) setProjectId(r.data[0].id);
    });
  }, []);

  useEffect(() => {
    if (!projectId) return;
    sprintsApi.list({ project_id: projectId }).then((r) => setSprints(r.data));
    tasksApi.list({ project_id: projectId }).then((r) => setAllTasks(r.data));
    setSelectedSprint(null);
    setSprintTasks([]);
  }, [projectId]);

  const loadSprintTasks = (sprint) => {
    setSelectedSprint(sprint);
    sprintsApi.tasks(sprint.id).then((r) => setSprintTasks(r.data));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    await sprintsApi.create({ ...form, project_id: projectId });
    setForm({ name: "", start_date: "", end_date: "", goal: "" });
    setShowCreate(false);
    sprintsApi.list({ project_id: projectId }).then((r) => setSprints(r.data));
  };

  const handleAssignTask = async (taskId) => {
    if (!selectedSprint) return;
    await tasksApi.update(taskId, { sprint_id: selectedSprint.id });
    sprintsApi.tasks(selectedSprint.id).then((r) => setSprintTasks(r.data));
    tasksApi.list({ project_id: projectId }).then((r) => setAllTasks(r.data));
  };

  const backlogTasks = allTasks.filter((t) => !t.sprint_id);
  const sprintCompletion = sprints.reduce((acc, sprint) => {
    const sprintItems = allTasks.filter((task) => task.sprint_id === sprint.id);
    const isCompleted = sprintItems.length > 0 && sprintItems.every((task) => task.status === "Done");
    acc[sprint.id] = isCompleted;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="ai-page-title">Sprints</h2>
          <p className="ai-muted mt-1">Plan iterations and pull work from the backlog.</p>
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
          {canManage && (
            <button type="button" onClick={() => setShowCreate(!showCreate)} className="ai-btn-primary">
              New sprint
            </button>
          )}
        </div>
      </div>

      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="ai-card grid max-w-xl grid-cols-2 gap-3 p-5"
        >
          <div className="col-span-2">
            <label htmlFor="sp-name" className="ai-label">
              Sprint name
            </label>
            <input
              id="sp-name"
              required
              className="ai-input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="sp-start" className="ai-label">
              Start date
            </label>
            <input
              id="sp-start"
              type="date"
              className="ai-input"
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="sp-end" className="ai-label">
              End date
            </label>
            <input
              id="sp-end"
              type="date"
              className="ai-input"
              value={form.end_date}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })}
            />
          </div>
          <div className="col-span-2">
            <label htmlFor="sp-goal" className="ai-label">
              Goal (optional)
            </label>
            <input
              id="sp-goal"
              className="ai-input"
              value={form.goal}
              onChange={(e) => setForm({ ...form, goal: e.target.value })}
            />
          </div>
          <div className="col-span-2 flex flex-wrap gap-2">
            <button type="submit" className="ai-btn-primary">
              Create sprint
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="ai-btn-ghost">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-ai-ink">All sprints</h3>
          {sprints.length === 0 && <p className="text-sm text-ai-subtle">No sprints yet.</p>}
          {sprints.map((s) => (
            <div key={s.id} className="space-y-2">
              <button
                type="button"
                onClick={() => loadSprintTasks(s)}
                className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/35 ${
                  selectedSprint?.id === s.id
                    ? "border-cyan-500/40 bg-cyan-500/10 text-ai-ink"
                    : "border-ai-line bg-ai-raised/60 hover:border-cyan-500/25"
                }`}
              >
                <p className="font-medium">{s.name}</p>
                {sprintCompletion[s.id] && (
                  <p className="mt-1 inline-flex rounded-md border border-emerald-500/25 bg-emerald-500/15 px-1.5 py-0.5 text-[11px] font-medium text-emerald-200">
                    Completed
                  </p>
                )}
                {s.start_date && (
                  <p className="mt-1 font-mono text-xs text-ai-subtle">
                    {s.start_date} → {s.end_date || "…"}
                  </p>
                )}
                {s.goal && <p className="mt-1 text-xs italic text-ai-subtle">{s.goal}</p>}
              </button>
              {canManage && (
                <div className="flex gap-2">
                  <Link to={`/sprint/${s.id}`} className="ai-btn-ghost py-1.5 text-xs">
                    Manage
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-ai-ink">
            {selectedSprint ? `Tasks in “${selectedSprint.name}”` : "Select a sprint"}
          </h3>
          {selectedSprint && sprintTasks.length === 0 && (
            <p className="text-sm text-ai-subtle">No tasks assigned.</p>
          )}
          {sprintTasks.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-ai-line bg-ai-raised/60 px-3 py-2.5 text-sm"
            >
              <div>
                <Link
                  to={`/tasks/${t.id}`}
                  className="font-medium text-ai-ink underline-offset-4 hover:underline"
                >
                  {t.title}
                </Link>
                <p className="text-xs text-ai-subtle">{t.status}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-ai-ink">Backlog ({backlogTasks.length})</h3>
          {backlogTasks.length === 0 && (
            <p className="text-sm text-ai-subtle">No backlog tasks.</p>
          )}
          {backlogTasks.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-ai-line bg-ai-raised/60 px-3 py-2.5 text-sm"
            >
              <div>
                <Link
                  to={`/tasks/${t.id}`}
                  className="font-medium text-ai-ink underline-offset-4 hover:underline"
                >
                  {t.title}
                </Link>
                <p className="text-xs text-ai-subtle">{t.status}</p>
              </div>
              {canManage && selectedSprint && (
                <button
                  type="button"
                  onClick={() => handleAssignTask(t.id)}
                  className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-cyan-400 hover:bg-cyan-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/35"
                >
                  Add →
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
