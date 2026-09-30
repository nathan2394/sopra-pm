import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/lib/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Backlog from "@/pages/Backlog";
import DailyTasks from "@/pages/DailyTasks";
import WeeklySummary from "@/pages/WeeklySummary";
import PublicWeeklyReport from "@/pages/PublicWeeklyReport";
import SprintBoard from "@/pages/SprintBoard";
import Sprints from "@/pages/Sprints";
import Team from "@/pages/Team";
import Roadmap from "@/pages/Roadmap";
import Projects from "@/pages/Projects";
import ProjectDetail from "@/pages/ProjectDetail";
import { Toaster } from "@/components/ui/sonner";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          {/* Shared with management: no sign-in, no navigation chrome. */}
          <Route path="/report/weekly" element={<PublicWeeklyReport />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/projects/:id" element={<ProjectDetail />} />
              <Route path="/backlog" element={<Backlog />} />
              <Route path="/daily" element={<DailyTasks />} />
              <Route path="/weekly" element={<WeeklySummary />} />
              <Route path="/board" element={<SprintBoard />} />
              <Route path="/sprints" element={<Sprints />} />
              <Route path="/roadmap" element={<Roadmap />} />
              <Route path="/team" element={<Team />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Route>
        </Routes>
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
