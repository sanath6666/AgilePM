import React, { createContext, useContext, useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { usersApi } from "./api/client";
import Layout from "./components/Layout";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import ProjectDetails from "./pages/ProjectDetails";
import ProjectEdit from "./pages/ProjectEdit";
import Kanban from "./pages/Kanban";
import Sprint from "./pages/Sprint";
import SprintDetails from "./pages/SprintDetails";
import BugTracker from "./pages/BugTracker";
import Notifications from "./pages/Notifications";
import BugDetails from "./pages/BugDetails";
import BugEdit from "./pages/BugEdit";
import TaskDetails from "./pages/TaskDetails";
import TaskEdit from "./pages/TaskEdit";

export const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }
    usersApi
      .me()
      .then((res) => setUser(res.data))
      .catch(() => localStorage.removeItem("token"))
      .finally(() => setLoading(false));
  }, []);

  const login = (token) => {
    localStorage.setItem("token", token);
    return usersApi.me().then((res) => setUser(res.data));
  };

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
  };

  if (loading) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-ai-base text-ai-ink">
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-cyan-500/30 border-t-cyan-400"
          aria-hidden="true"
        />
        <p className="font-mono text-sm text-ai-subtle">Loading workspace…</p>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

function RequireAuth({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function PublicLanding() {
  const { user } = useAuth();
  if (user) return <Navigate to="/dashboard" replace />;
  return <Landing />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<PublicLanding />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="projects" element={<Projects />} />
            <Route path="projects/:projectId" element={<ProjectDetails />} />
            <Route path="projects/:projectId/edit" element={<ProjectEdit />} />
            <Route path="kanban" element={<Kanban />} />
            <Route path="sprint" element={<Sprint />} />
            <Route path="sprint/:sprintId" element={<SprintDetails />} />
            <Route path="bugs" element={<BugTracker />} />
            <Route path="bugs/:bugId" element={<BugDetails />} />
            <Route path="bugs/:bugId/edit" element={<BugEdit />} />
            <Route path="tasks/:taskId" element={<TaskDetails />} />
            <Route path="tasks/:taskId/edit" element={<TaskEdit />} />
            <Route path="notifications" element={<Notifications />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
