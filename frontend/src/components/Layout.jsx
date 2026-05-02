import React, { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../App";
import { notificationsApi } from "../api/client";

const NAV = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/projects", label: "Projects" },
  { to: "/kanban", label: "Kanban" },
  { to: "/sprint", label: "Sprints" },
  { to: "/bugs", label: "Bug Tracker" },
  { to: "/notifications", label: "Notifications" },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unread, setUnread] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const fetchUnread = () => {
      notificationsApi
        .list({ unread_only: true })
        .then((res) => setUnread(res.data.length))
        .catch(() => {});
    };
    fetchUnread();
    const id = setInterval(fetchUnread, 30000);
    return () => clearInterval(id);
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const NavLinks = ({ onNavigate } = {}) => (
    <>
      {NAV.map(({ to, label }) => {
        const active = location.pathname.startsWith(to);
        return (
          <Link
            key={to}
            to={to}
            onClick={onNavigate}
            className={`flex min-h-[44px] items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/35 ${
              active
                ? "bg-gradient-to-r from-cyan-500/15 to-violet-500/10 text-cyan-100 ring-1 ring-cyan-500/25"
                : "text-ai-subtle hover:bg-white/5 hover:text-ai-ink"
            }`}
          >
            <span>{label}</span>
            {label === "Notifications" && unread > 0 && (
              <span
                className="ml-2 min-w-[1.25rem] rounded-full bg-rose-500/90 px-1.5 py-0.5 text-center text-xs font-bold text-white"
                aria-label={`${unread} unread notifications`}
              >
                {unread}
              </span>
            )}
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="flex min-h-dvh bg-ai-base text-ai-ink">
      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        id="app-sidebar"
        className={`fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col border-r border-ai-line bg-ai-void/95 shadow-ai-card backdrop-blur-xl transition-transform duration-200 md:static md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
        aria-label="Main navigation"
      >
        <div className="border-b border-ai-line px-4 py-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-400/90">Nexus PM</p>
          <h1 className="mt-1 text-lg font-bold tracking-tight">Workspace</h1>
          <p className="text-xs text-ai-subtle">AI-enhanced agile</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
          <NavLinks onNavigate={() => setMobileOpen(false)} />
        </nav>
        <div className="border-t border-ai-line px-4 py-4">
          <p className="truncate text-sm font-medium text-ai-ink">{user?.name}</p>
          <p className="text-xs capitalize text-ai-subtle">{user?.role}</p>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-3 min-h-[44px] w-full rounded-xl border border-ai-line py-2 text-left text-sm text-ai-subtle transition hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/40"
          >
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-ai-line bg-ai-base/85 px-4 py-3 backdrop-blur-md md:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-ai-line bg-ai-raised/80 text-ai-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/35"
            aria-expanded={mobileOpen}
            aria-controls="app-sidebar"
            aria-label="Open menu"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M4 7h16M4 12h16M4 17h16"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <span className="font-semibold tracking-tight">Nexus PM</span>
        </header>

        <main
          id="main-content"
          className="relative flex-1 overflow-y-auto bg-ai-glow-top bg-ai-grid bg-grid"
        >
          <div className="pointer-events-none absolute inset-0 bg-ai-glow-mid opacity-50" aria-hidden="true" />
          <div className="relative p-4 sm:p-6 lg:p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
