import React, { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { authApi } from "../api/client";
import { useAuth } from "../App";

export default function Login() {
  const navigate = useNavigate();
  const { user, login } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await authApi.login(form);
      await login(res.data.access_token);
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.detail || "Login failed");
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
          <h1 className="text-2xl font-bold tracking-tight">Sign in</h1>
          <p className="mt-1 font-mono text-xs text-ai-subtle">Nexus PM workspace</p>

          {error && (
            <div
              className="mt-5 rounded-xl border border-rose-500/35 bg-rose-500/10 px-3 py-3 text-sm text-rose-200"
              role="alert"
            >
              {typeof error === "string" ? error : "Login failed"}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="login-email" className="ai-label">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                required
                className="ai-input"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="login-password" className="ai-label">
                Password
              </label>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                required
                className="ai-input"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
            <button type="submit" disabled={loading} className="ai-btn-primary w-full">
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-ai-subtle">
            No account?{" "}
            <Link
              to="/register"
              className="font-medium text-cyan-400 underline-offset-2 hover:text-cyan-300 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40 rounded"
            >
              Register
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
