import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const client = axios.create({ baseURL: API_URL });

client.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export default client;

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  register: (data) => client.post("/auth/register", data),
  login: (data) => client.post("/auth/login", data),
};

// ── Users ─────────────────────────────────────────────────────────────────────
export const usersApi = {
  me: () => client.get("/users/me"),
  list: () => client.get("/users"),
};

// ── Projects ──────────────────────────────────────────────────────────────────
export const projectsApi = {
  list: () => client.get("/projects"),
  get: (id) => client.get(`/projects/${id}`),
  create: (data) => client.post("/projects", data),
  update: (id, data) => client.patch(`/projects/${id}`, data),
  delete: (id) => client.delete(`/projects/${id}`),
  addMember: (id, user_id) => client.post(`/projects/${id}/members`, { user_id }),
  removeMember: (id, user_id) => client.delete(`/projects/${id}/members/${user_id}`),
};

// ── Tasks ─────────────────────────────────────────────────────────────────────
export const tasksApi = {
  list: (params) => client.get("/tasks", { params }),
  getDelayed: (params) => client.get("/tasks/delayed", { params }),
  get: (id) => client.get(`/tasks/${id}`),
  create: (data) => client.post("/tasks", data),
  update: (id, data) => client.patch(`/tasks/${id}`, data),
  delete: (id) => client.delete(`/tasks/${id}`),
  recomputeDelays: (params) => client.post("/tasks/recompute-delays", null, { params }),
};

// ── Bugs ──────────────────────────────────────────────────────────────────────
export const bugsApi = {
  list: (params) => client.get("/bugs", { params }),
  get: (id) => client.get(`/bugs/${id}`),
  create: (data) => client.post("/bugs", data),
  update: (id, data) => client.patch(`/bugs/${id}`, data),
  delete: (id) => client.delete(`/bugs/${id}`),
  merge: (data) => client.post("/bugs/merge", data),
  similar: (id) => client.get(`/bugs/${id}/similar`),
};

// ── Sprints ───────────────────────────────────────────────────────────────────
export const sprintsApi = {
  list: (params) => client.get("/sprints", { params }),
  get: (id) => client.get(`/sprints/${id}`),
  tasks: (id) => client.get(`/sprints/${id}/tasks`),
  create: (data) => client.post("/sprints", data),
  update: (id, data) => client.patch(`/sprints/${id}`, data),
  delete: (id) => client.delete(`/sprints/${id}`),
};

// ── Notifications ──────────────────────────────────────────────────────────────
export const notificationsApi = {
  list: (params) => client.get("/notifications", { params }),
  markRead: (id) => client.patch(`/notifications/${id}/read`),
  markAllRead: () => client.patch("/notifications/read-all"),
};

// ── AI ────────────────────────────────────────────────────────────────────────
export const aiApi = {
  checkDuplicate: (data) => client.post("/ai/check-duplicate", data),
  /** GPT triage — requires OPENAI_API_KEY on backend */
  enhanceBug: (data) => client.post("/ai/enhance-bug", data),
  /** GPT delay summary — requires OPENAI_API_KEY on backend */
  narrateDelays: (data) => client.post("/ai/narrate-delays", data),
};

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const dashboardApi = {
  summary: (params) => client.get("/dashboard/summary", { params }),
  delayAnalytics: (params) => client.get("/dashboard/delay-analytics", { params }),
};
