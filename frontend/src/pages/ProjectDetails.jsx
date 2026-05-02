import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { projectsApi, usersApi } from "../api/client";
import { useAuth } from "../App";

export default function ProjectDetails() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [project, setProject] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    setError("");

    Promise.all([projectsApi.get(projectId), usersApi.list()])
      .then(([projectRes, usersRes]) => {
        setProject(projectRes.data);
        setUsers(usersRes.data || []);
      })
      .catch((err) => setError(err.response?.data?.detail || "Could not load project details."))
      .finally(() => setLoading(false));
  }, [projectId]);

  const canManage = useMemo(() => {
    if (!project || !user) return false;
    if (user.role === "admin") return true;
    if (user.role !== "manager") return false;
    return (project.member_ids || []).includes(user.id);
  }, [project, user]);

  const memberNames = useMemo(() => {
    const byId = new Map(users.map((u) => [u.id, u]));
    return (project?.member_ids || []).map((uid) => byId.get(uid) || { id: uid, name: uid.slice(-6) });
  }, [project, users]);

  const handleDelete = async () => {
    if (!project) return;
    if (!window.confirm(`Delete project "${project.name}"?`)) return;

    setDeleting(true);
    try {
      await projectsApi.delete(project.id);
      navigate("/projects");
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to delete project.");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <p className="text-sm text-ai-subtle">Loading project details…</p>;
  if (error) return <p className="text-sm text-rose-300">{error}</p>;
  if (!project) return <p className="text-sm text-ai-subtle">Project not found.</p>;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="ai-page-title">Project details</h2>
        <Link to="/projects" className="ai-btn-ghost">
          Back to projects
        </Link>
      </div>

      <div className="ai-card space-y-5 p-5">
        <div>
          <p className="ai-label">Name</p>
          <p className="mt-1 text-lg font-semibold text-ai-ink">{project.name}</p>
        </div>

        <div>
          <p className="ai-label">Description</p>
          <p className="mt-1 text-sm text-ai-subtle">{project.description || "No description provided."}</p>
        </div>

        <div>
          <p className="ai-label">Members ({memberNames.length})</p>
          {memberNames.length === 0 ? (
            <p className="mt-1 text-sm text-ai-subtle">No members yet.</p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              {memberNames.map((member) => (
                <span
                  key={member.id}
                  className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 text-xs text-cyan-100"
                >
                  {member.name}
                </span>
              ))}
            </div>
          )}
        </div>

        {canManage && (
          <div className="flex flex-wrap gap-2 border-t border-ai-line pt-4">
            <Link to={`/projects/${project.id}/edit`} className="ai-btn-primary">
              Edit project
            </Link>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-200 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deleting ? "Deleting..." : "Delete project"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
