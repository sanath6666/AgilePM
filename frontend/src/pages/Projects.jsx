import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { projectsApi, usersApi } from "../api/client";
import { useAuth } from "../App";

export default function Projects() {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const canCreate = ["admin", "manager"].includes(user?.role);

  const load = () => {
    Promise.all([projectsApi.list(), usersApi.list()])
      .then(([p, u]) => {
        setProjects(p.data);
        setUsers(u.data || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await projectsApi.create(form);
      setForm({ name: "", description: "" });
      setShowCreate(false);
      load();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to create project");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-ai-subtle">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500/30 border-t-cyan-400" />
        Loading projects…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="ai-page-title">Projects</h2>
          <p className="ai-muted mt-1">Organize teams and backlogs.</p>
        </div>
        {canCreate && (
          <button type="button" onClick={() => setShowCreate(!showCreate)} className="ai-btn-primary">
            New project
          </button>
        )}
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="ai-card max-w-md space-y-4 p-5">
          {error && (
            <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {error}
            </p>
          )}
          <div>
            <label htmlFor="proj-name" className="ai-label">
              Name
            </label>
            <input
              id="proj-name"
              required
              className="ai-input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="proj-desc" className="ai-label">
              Description
            </label>
            <textarea
              id="proj-desc"
              rows={2}
              className="ai-input min-h-[88px] resize-y"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="ai-btn-primary">
              Create
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="ai-btn-ghost">
              Cancel
            </button>
          </div>
        </form>
      )}

      {projects.length === 0 ? (
        <div className="ai-card p-8 text-center">
          <p className="text-ai-subtle">No projects yet.</p>
          {canCreate && (
            <button type="button" onClick={() => setShowCreate(true)} className="ai-btn-secondary mt-4">
              Create your first project
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => (
            <div key={p.id} className="ai-card flex flex-col gap-4 p-5">
              <div className="min-w-0">
                <h3 className="font-semibold text-ai-ink">{p.name}</h3>
                <p className="mt-1 text-sm text-ai-subtle">{p.description || "No description provided."}</p>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ai-subtle">
                  Members ({p.member_ids?.length || 0})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {(p.member_ids || []).map((uid) => {
                    const found = users.find((u) => u.id === uid);
                    return (
                      <span
                        key={uid}
                        className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 text-xs text-cyan-100"
                      >
                        {found ? found.name : uid.slice(-6)}
                      </span>
                    );
                  })}
                </div>
              </div>
              <div className="pt-1">
                <Link to={`/projects/${p.id}`} className="ai-btn-secondary inline-flex">
                  View details
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
