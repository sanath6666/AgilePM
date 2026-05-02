import React, { useEffect, useState } from "react";
import { notificationsApi } from "../api/client";

const TYPE_STYLES = {
  assignment: "border-sky-500/25 bg-sky-500/10 text-sky-100",
  delay: "border-rose-500/25 bg-rose-500/10 text-rose-100",
  sprint: "border-violet-500/25 bg-violet-500/10 text-violet-100",
  bug: "border-amber-500/25 bg-amber-500/10 text-amber-100",
  project: "border-cyan-500/25 bg-cyan-500/10 text-cyan-100",
  info: "border-ai-line bg-ai-raised/80 text-ai-ink",
};

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = () => {
    notificationsApi
      .list({ unread_only: unreadOnly })
      .then((r) => setNotifications(r.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [unreadOnly]);

  const handleMarkRead = async (id) => {
    await notificationsApi.markRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const handleMarkAll = async () => {
    await notificationsApi.markAllRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="ai-page-title">Notifications</h2>
          {unreadCount > 0 && (
            <p className="ai-muted mt-1">
              {unreadCount} unread — including AI delay and assignment signals.
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border border-ai-line bg-ai-raised/50 px-3 text-sm text-ai-subtle">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => setUnreadOnly(e.target.checked)}
              className="h-4 w-4 rounded border-ai-line bg-ai-base text-cyan-500 focus:ring-cyan-500/30"
            />
            Unread only
          </label>
          {unreadCount > 0 && (
            <button type="button" onClick={handleMarkAll} className="ai-btn-secondary px-4 py-2 text-sm">
              Mark all read
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 text-ai-subtle">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500/30 border-t-cyan-400" />
          Loading…
        </div>
      ) : notifications.length === 0 ? (
        <div className="ai-card p-8 text-center text-ai-subtle">No notifications.</div>
      ) : (
        <ul className="space-y-3" aria-live="polite">
          {notifications.map((n) => {
            const style = TYPE_STYLES[n.type] || TYPE_STYLES.info;
            return (
              <li key={n.id}>
                <article
                  className={`flex items-start justify-between gap-3 rounded-2xl border p-4 transition ${style} ${
                    n.read ? "opacity-55" : ""
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-snug">{n.message}</p>
                    <p className="mt-1 font-mono text-xs opacity-70">{timeAgo(n.created_at)}</p>
                  </div>
                  {!n.read && (
                    <button
                      type="button"
                      onClick={() => handleMarkRead(n.id)}
                      className="shrink-0 rounded-lg px-3 py-2 text-xs font-medium text-current underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40"
                    >
                      Mark read
                    </button>
                  )}
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
