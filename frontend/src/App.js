import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import Backlog from "@/pages/Backlog";
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
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:id" element={<ProjectDetail />} />
          <Route path="/backlog" element={<Backlog />} />
          <Route path="/board" element={<SprintBoard />} />
          <Route path="/sprints" element={<Sprints />} />
          <Route path="/roadmap" element={<Roadmap />} />
          <Route path="/team" element={<Team />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <Toaster position="top-right" richColors />
    </BrowserRouter>
  );
}

export default App;
