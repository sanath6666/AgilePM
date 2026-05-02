import React, { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { authApi } from "../api/client";
import { useAuth } from "../App";

const ROLES = ["developer", "tester", "manager", "admin"];

export default function Register() {
  const navigate = useNavigate();
  const { user, login } = useAuth();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "developer",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await authApi.register(form);
      await login(res.data.access_token);
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.detail || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-dvh overflow-hidden bg-ai-base text-ai-ink">
      <div className="pointer-events-none absolute inset-0 bg-ai-glow-top" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 bg-ai-glow-mid" aria-hidden="true" />
      <div
        className="pointer-events-none absolute inset-0 bg-ai-grid bg-grid opacity-80"
        aria-hidden="true"
      />

      <main
        id="main-content"
        className="relative z-10 mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-4 py-12 sm:px-6"
      >
        <Link
          to="/"
          className="mb-8 inline-flex items-center gap-2 self-start font-mono text-xs text-cyan-400/90 transition hover:text-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40 rounded-lg px-1"
        >
          Back to home
        </Link>

        <div className="ai-panel">
          <h1 className="text-2xl font-bold tracking-tight">Create account</h1>
          <p className="mt-1 font-mono text-xs text-ai-subtle">Join Nexus PM</p>

          {error && (
            <div
              className="mt-5 rounded-xl border border-rose-500/35 bg-rose-500/10 px-3 py-3 text-sm text-rose-200"
              role="alert"
            >
              {typeof error === "string" ? error : "Registration failed"}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="reg-name" className="ai-label">
                Name
              </label>
              <input
                id="reg-name"
                required
                autoComplete="name"
                className="ai-input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="reg-email" className="ai-label">
                Email
              </label>
              <input
                id="reg-email"
                type="email"
                required
                autoComplete="email"
                className="ai-input"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="reg-password" className="ai-label">
                Password
              </label>
              <input
                id="reg-password"
                type="password"
                required
                autoComplete="new-password"
                className="ai-input"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="reg-role" className="ai-label">
                Role
              </label>
              <select
                id="reg-role"
                className="ai-select"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-ai-subtle">
                Demo mode: pick any role to explore permissions. In production, roles would be assigned by an admin.
              </p>
            </div>
            <button type="submit" disabled={loading} className="ai-btn-primary w-full">
              {loading ? "Creating account…" : "Register"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-ai-subtle">
            Already have an account?{" "}
            <Link
              to="/login"
              className="font-medium text-cyan-400 underline-offset-2 hover:text-cyan-300 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40 rounded"
            >
              Sign in
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
