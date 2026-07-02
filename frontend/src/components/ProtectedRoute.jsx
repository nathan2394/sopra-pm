import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { Lightning } from "@phosphor-icons/react";

export default function ProtectedRoute() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-sm bg-[#0033CC] flex items-center justify-center animate-pulse">
            <Lightning size={20} weight="fill" color="white" />
          </div>
          <div className="text-xs font-mono uppercase tracking-widest text-slate-400">
            Loading…
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
