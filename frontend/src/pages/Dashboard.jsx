import React, { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { aiApi, dashboardApi, projectsApi, tasksApi } from "../api/client";

const COLORS = ["#22d3ee", "#fbbf24", "#34d399", "#fb7185", "#a78bfa", "#38bdf8"];

function StatCard({ label, value, variant = "cyan" }) {
  const map = {
    cyan: "border-cyan-500/25 bg-cyan-500/10 text-cyan-100",
    rose: "border-rose-500/25 bg-rose-500/10 text-rose-100",
    emerald: "border-emerald-500/25 bg-emerald-500/10 text-emerald-100",
    amber: "border-amber-500/25 bg-amber-500/10 text-amber-100",
  };
  return (
    <div className={`rounded-2xl border p-4 shadow-ai-inset ${map[variant]}`}>
      <p className="text-sm font-medium text-ai-subtle">{label}</p>
      <p className="mt-1 font-mono text-3xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

const chartTooltipStyle = {
  backgroundColor: "rgba(17, 24, 39, 0.95)",
  border: "1px solid rgba(148, 163, 184, 0.2)",
  borderRadius: "12px",
  fontSize: "12px",
  color: "#e2e8f0",
};

const chartTooltipLabelStyle = {
  color: "#e2e8f0",
};

const chartTooltipItemStyle = {
  color: "#e2e8f0",
};

const formatDateDDMMYYYY = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
};

export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState("");
  const [summary, setSummary] = useState(null);
  const [delays, setDelays] = useState(null);
  const [loading, setLoading] = useState(true);
  const [delayNarrative, setDelayNarrative] = useState("");
  const [narrativeLoading, setNarrativeLoading] = useState(false);
  const [narrativeError, setNarrativeError] = useState("");

  useEffect(() => {
    projectsApi
      .list()
      .then((res) => {
        const items = res.data || [];
        setProjects(items);
        if (items.length > 0) {
          setProjectId(items[0].id);
        } else {
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    Promise.all([
      dashboardApi.summary({ project_id: projectId }),
      dashboardApi.delayAnalytics({ project_id: projectId }),
    ])
      .then(([s, d]) => {
        setSummary(s.data);
        setDelays(d.data);
      })
      .finally(() => setLoading(false));

    tasksApi.recomputeDelays({ project_id: projectId }).catch(() => {});
  }, [projectId]);

  const handleNarrateDelays = async () => {
    if (!delays) return;
    setNarrativeLoading(true);
    setNarrativeError("");
    setDelayNarrative("");
    try {
      const forecast = delays.forecast || {};
      const res = await aiApi.narrateDelays({
        delayed_count: delays.delayed_count ?? 0,
        on_time_count: delays.on_time_count ?? 0,
        sample_titles: (delays.sample_delayed_tasks || []).map((t) => t.title).filter(Boolean),
        expected_completion_date: forecast.expected_completion_date,
        throughput_per_week: forecast.throughput_per_week,
        open_tasks: forecast.open_tasks,
        delay_risk_ratio: forecast.delay_risk_ratio,
        forecast_method: forecast.method,
      });
      setDelayNarrative(res.data.narrative);
    } catch (err) {
      const d = err.response?.data?.detail;
      setNarrativeError(typeof d === "string" ? d : "Could not generate summary.");
    } finally {
      setNarrativeLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-ai-subtle">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500/30 border-t-cyan-400"
          aria-hidden="true"
        />
        Loading dashboard…
      </div>
    );
  }

  const statusData = summary
    ? Object.entries(summary.tasks_by_status).map(([name, value]) => ({ name, value }))
    : [];

  const severityData = summary
    ? Object.entries(summary.bugs_by_severity).map(([name, value]) => ({ name, value }))
    : [];

  const delayChartData = delays
    ? [
        { name: "Delayed", value: delays.delayed_count },
        { name: "On Time", value: delays.on_time_count },
      ]
    : [];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="ai-page-title">Dashboard</h2>
        <p className="ai-muted mt-1">Live aggregates and delay analytics for your workspace.</p>
      </div>
      <div>
        <select
          className="ai-select w-auto min-w-[180px]"
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
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total tasks" value={summary?.total_tasks ?? 0} variant="cyan" />
        <StatCard label="Delayed tasks" value={summary?.delayed_tasks ?? 0} variant="rose" />
        <StatCard label="Total bugs" value={summary?.total_bugs ?? 0} variant="amber" />
        <StatCard label="On time" value={delays?.on_time_count ?? 0} variant="emerald" />
      </div>
      {delays?.forecast && (
        <div className="ai-card flex flex-wrap items-center gap-4 p-4 text-sm">
          <span className="rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-2 py-1 text-cyan-100">
            Expected completion: {formatDateDDMMYYYY(delays.forecast.expected_completion_date)}
          </span>
          <span className="text-ai-subtle">
            Throughput: {delays.forecast.throughput_per_week}/week
          </span>
          <span className="text-ai-subtle">Open tasks: {delays.forecast.open_tasks}</span>
        </div>
      )}

      <div className="ai-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-ai-ink">GPT delay narrative</p>
          <p className="text-xs text-ai-subtle">
            Optional OpenAI layer — turn counts into a short status blurb (requires{" "}
            <code className="font-mono text-cyan-400/90">OPENAI_API_KEY</code> on the API).
          </p>
        </div>
        <button
          type="button"
          onClick={handleNarrateDelays}
          disabled={narrativeLoading}
          className="ai-btn-secondary shrink-0 border-cyan-500/25 bg-cyan-500/10 text-cyan-100 disabled:opacity-50"
        >
          {narrativeLoading ? "Generating…" : "Summarize delays"}
        </button>
      </div>
      {narrativeError && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {narrativeError}
        </div>
      )}
      {delayNarrative && (
        <div className="ai-card border-cyan-500/20 p-5">
          <p className="font-mono text-[10px] uppercase tracking-wider text-cyan-400/90">GPT summary</p>
          <p className="mt-2 text-sm leading-relaxed text-ai-ink">{delayNarrative}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="ai-card p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold text-ai-ink">Tasks by status</h3>
          <p className="text-xs text-ai-subtle">Distribution across workflow columns</p>
          {statusData.length > 0 ? (
            <div className="mt-4 h-[220px] w-full" role="img" aria-label="Bar chart of tasks by status">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusData}>
                  <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} stroke="#334155" />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} stroke="#334155" allowDecimals={false} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Bar dataKey="value" fill="#22d3ee" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="mt-6 text-sm text-ai-subtle">No tasks yet — create one from Kanban.</p>
          )}
        </div>

        <div className="ai-card p-5">
          <h3 className="text-sm font-semibold text-ai-ink">Delay overview</h3>
          <p className="text-xs text-ai-subtle">Past deadline vs on track</p>
          {delayChartData.some((d) => d.value > 0) ? (
            <div className="mt-4 h-[220px] w-full" role="img" aria-label="Pie chart of delay overview">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={delayChartData}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={72}
                    label={{ fill: "#e2e8f0", fontSize: 11 }}
                  >
                    {delayChartData.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? "#fb7185" : "#34d399"} />
                    ))}
                  </Pie>
                  <Legend wrapperStyle={{ color: "#94a3b8", fontSize: "12px" }} />
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                    labelStyle={chartTooltipLabelStyle}
                    itemStyle={chartTooltipItemStyle}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="mt-6 text-sm text-ai-subtle">No delay data yet.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="ai-card p-5">
          <h3 className="text-sm font-semibold text-ai-ink">Bugs by severity</h3>
          {severityData.length > 0 ? (
            <div className="mt-4 h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={severityData} dataKey="value" nameKey="name" outerRadius={72}>
                    {severityData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend wrapperStyle={{ color: "#94a3b8", fontSize: "12px" }} />
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                    labelStyle={chartTooltipLabelStyle}
                    itemStyle={chartTooltipItemStyle}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="mt-6 text-sm text-ai-subtle">No bugs yet.</p>
          )}
        </div>

        <div className="ai-card p-5">
          <h3 className="text-sm font-semibold text-ai-ink">Monthly task creation</h3>
          {delays?.monthly_trend?.length > 0 ? (
            <div className="mt-4 h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={delays.monthly_trend}>
                  <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 10 }} stroke="#334155" />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} stroke="#334155" allowDecimals={false} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Bar dataKey="tasks_created" fill="#a78bfa" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="mt-6 text-sm text-ai-subtle">No trend data yet.</p>
          )}
        </div>
      </div>

      {delays?.sample_delayed_tasks?.length > 0 && (
        <div className="ai-card overflow-hidden p-5">
          <h3 className="text-sm font-semibold text-ai-ink">Sample delayed tasks</h3>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-ai-line text-left text-ai-subtle">
                  <th className="pb-3 font-medium">Title</th>
                  <th className="pb-3 font-medium">Deadline</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Priority</th>
                </tr>
              </thead>
              <tbody>
                {delays.sample_delayed_tasks.map((t) => (
                  <tr key={t.id} className="border-b border-ai-line/60 last:border-0">
                    <td className="py-3 font-medium text-rose-200">{t.title}</td>
                    <td className="py-3 font-mono text-xs text-ai-subtle">{t.deadline}</td>
                    <td className="py-3">
                      <span className="rounded-lg bg-rose-500/15 px-2 py-1 text-xs text-rose-200">
                        {t.status}
                      </span>
                    </td>
                    <td className="py-3 font-mono tabular-nums text-ai-subtle">{t.priority}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
