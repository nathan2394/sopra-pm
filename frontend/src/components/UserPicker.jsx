import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { CaretDown, SignOut, UserCircle } from "@phosphor-icons/react";

export default function UserPicker() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-2 px-2 py-1 rounded-sm border border-slate-200 hover:border-[#0033CC] hover:bg-slate-50 transition-colors"
          data-testid="user-picker"
        >
          {user ? (
            <div
              className="w-6 h-6 rounded-sm flex items-center justify-center text-[10px] font-bold text-white font-mono"
              style={{ backgroundColor: user.avatar_color || "#0033CC" }}
            >
              {user.name.slice(0, 2).toUpperCase()}
            </div>
          ) : (
            <UserCircle size={20} weight="duotone" className="text-slate-500" />
          )}
          <div className="text-left">
            <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500 leading-none">
              Signed in as
            </div>
            <div className="text-xs font-semibold text-slate-900 leading-tight">
              {user ? user.name : "—"}
            </div>
          </div>
          <CaretDown size={12} weight="bold" className="text-slate-400" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
          {user?.email || "Account"}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleLogout}
          className="text-red-600"
          data-testid="user-picker-logout"
        >
          <SignOut size={14} className="mr-2" /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
