import { NavLink, Outlet, useLocation } from "react-router-dom";
import UserPicker from "@/components/UserPicker";
import {
  ChartLine,
  Kanban,
  ListChecks,
  Users,
  Calendar,
  GridFour,
  Lightning,
  FolderOpen,
} from "@phosphor-icons/react";

const navItems = [
  { to: "/", label: "Dashboard", icon: ChartLine, testId: "nav-dashboard" },
  { to: "/projects", label: "Projects", icon: FolderOpen, testId: "nav-projects" },
  { to: "/backlog", label: "Backlog", icon: ListChecks, testId: "nav-backlog" },
  { to: "/board", label: "Sprint Board", icon: Kanban, testId: "nav-board" },
  { to: "/sprints", label: "Sprints", icon: Calendar, testId: "nav-sprints" },
  { to: "/roadmap", label: "Roadmap", icon: GridFour, testId: "nav-roadmap" },
  { to: "/team", label: "Team", icon: Users, testId: "nav-team" },
];

const TITLES = {
  "/": "Delivery Dashboard",
  "/projects": "Projects",
  "/backlog": "Product Backlog",
  "/board": "Sprint Board",
  "/sprints": "Sprint Management",
  "/roadmap": "Quarterly Roadmap",
  "/team": "Team & Ownership",
};

export default function Layout() {
  const location = useLocation();
  let title = TITLES[location.pathname] || "SOPRA PM";
  if (location.pathname.startsWith("/projects/") && location.pathname !== "/projects") {
    title = "Project Detail";
  }

  return (
    <div className="min-h-screen flex bg-[#F8F9FA]" data-testid="app-root">
      {/* Sidebar */}
      <aside
        className="w-60 border-r border-slate-200 bg-white flex flex-col"
        data-testid="sidebar"
      >
        <div className="p-5 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-sm bg-[#0033CC] flex items-center justify-center">
              <Lightning size={18} weight="fill" color="white" />
            </div>
            <div>
              <div className="font-display font-black text-base tracking-tight text-slate-900 leading-none">
                SOPRA PM
              </div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mt-0.5">
                IT Control Room
              </div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                data-testid={item.testId}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-sm text-sm transition-colors ${
                    isActive
                      ? "bg-[#0033CC] text-white font-semibold"
                      : "text-slate-700 hover:bg-slate-100"
                  }`
                }
              >
                <Icon size={18} weight="duotone" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200">
          <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
            Active Cycle
          </div>
          <div className="font-display font-bold text-slate-900 mt-1">
            Q3 2026
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            Jul – Sep · 6 sprints
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        <header
          className="border-b border-slate-200 bg-white px-8 py-4 flex items-center justify-between"
          data-testid="page-header"
        >
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
              IT Department · Project Manager Console
            </div>
            <h1
              className="font-display font-black text-2xl tracking-tighter text-slate-900 mt-0.5"
              data-testid="page-title"
            >
              {title}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <UserPicker />
            <div className="text-right">
              <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                Today
              </div>
              <div className="text-sm font-semibold text-slate-900 font-mono">
                {new Date().toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </div>
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-auto p-8 scrollbar-thin">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
