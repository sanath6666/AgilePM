import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { projectsApi, usersApi } from "../api/client";
import { useAuth } from "../App";

export default function ProjectEdit() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [project, setProject] = useState(null);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ name: "", description: "" });
  const [memberInput, setMemberInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    setError("");

    Promise.all([projectsApi.get(projectId), usersApi.list()])
      .then(([projectRes, usersRes]) => {
        const p = projectRes.data;
        setProject(p);
        setUsers(usersRes.data || []);
        setForm({
          name: p.name || "",
          description: p.description || "",
        });
      })
      .catch((err) => setError(err.response?.data?.detail || "Could not load project for editing."))
      .finally(() => setLoading(false));
  }, [projectId]);

  const canManage = useMemo(() => {
    if (!project || !user) return false;
    if (user.role === "admin") return true;
    if (user.role !== "manager") return false;
    return (project.member_ids || []).includes(user.id);
  }, [project, user]);

  const availableUsers = useMemo(() => {
    if (!project) return [];
    const memberSet = new Set(project.member_ids || []);
    return users.filter((u) => !memberSet.has(u.id));
  }, [project, users]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!project) return;
    setSaving(true);
    setError("");
    setSaveMessage("");

    try {
      await projectsApi.update(project.id, form);
      const refreshed = await projectsApi.get(project.id);
      setProject(refreshed.data);
      setSaveMessage("Project updated.");
    } catch (err) {
      setError(err.response?.data?.detail || "Could not update project.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddMember = async () => {
    if (!project || !memberInput) return;
    setError("");
    setSaveMessage("");
    try {
      await projectsApi.addMember(project.id, memberInput);
      const refreshed = await projectsApi.get(project.id);
      setProject(refreshed.data);
      setMemberInput("");
      setSaveMessage("Member added.");
    } catch (err) {
      setError(err.response?.data?.detail || "Could not add member.");
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!project) return;
    setError("");
    setSaveMessage("");
    try {
      await projectsApi.removeMember(project.id, userId);
      const refreshed = await projectsApi.get(project.id);
      setProject(refreshed.data);
      setSaveMessage("Member removed.");
    } catch (err) {
      setError(err.response?.data?.detail || "Could not remove member.");
    }
  };

  if (loading) return <p className="text-sm text-ai-subtle">Loading project editor…</p>;
  if (error && !project) return <p className="text-sm text-rose-300">{error}</p>;
  if (!project) return <p className="text-sm text-ai-subtle">Project not found.</p>;
  if (!canManage) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-rose-300">Only this project&apos;s manager or admins can edit it.</p>
        <Link to={`/projects/${project.id}`} className="ai-btn-ghost inline-flex">
          Back to details
        </Link>
      </div>
    );
  }

  const userById = new Map(users.map((u) => [u.id, u]));

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="ai-page-title">Edit project</h2>
        <button type="button" className="ai-btn-ghost" onClick={() => navigate(`/projects/${project.id}`)}>
          Back to details
        </button>
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
          <label htmlFor="edit-project-name" className="ai-label mb-1">
            Name
          </label>
          <input
            id="edit-project-name"
            required
            className="ai-input"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          />
        </div>

        <div>
          <label htmlFor="edit-project-desc" className="ai-label mb-1">
            Description
          </label>
          <textarea
            id="edit-project-desc"
            rows={4}
            className="ai-input min-h-[120px]"
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
          />
        </div>

        <button type="submit" disabled={saving} className="ai-btn-primary disabled:opacity-60">
          {saving ? "Saving..." : "Save changes"}
        </button>
      </form>

      <div className="ai-card space-y-4 p-5">
        <h3 className="text-base font-semibold text-ai-ink">Members</h3>

        {(project.member_ids || []).length === 0 ? (
          <p className="text-sm text-ai-subtle">No members yet.</p>
        ) : (
          <div className="space-y-2">
            {(project.member_ids || []).map((uid) => {
              const member = userById.get(uid);
              return (
                <div
                  key={uid}
                  className="flex items-center justify-between gap-2 rounded-lg border border-ai-line bg-ai-raised/60 px-3 py-2"
                >
                  <div className="text-sm text-ai-ink">
                    {member ? `${member.name} (${member.role})` : uid.slice(-6)}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveMember(uid)}
                    className="rounded-lg px-2 py-1 text-xs text-rose-300 transition hover:bg-rose-500/15"
                  >
                    Remove
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            className="ai-select flex-1 text-sm"
            value={memberInput}
            onChange={(e) => setMemberInput(e.target.value)}
            aria-label={`Add member to ${project.name}`}
          >
            <option value="">Add member…</option>
            {availableUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.role})
              </option>
            ))}
          </select>
          <button type="button" onClick={handleAddMember} className="ai-btn-secondary shrink-0 px-4">
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
