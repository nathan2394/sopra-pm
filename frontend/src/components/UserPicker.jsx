import { useEffect, useState } from "react";
import { fetchTeam } from "@/lib/api";
import { getActorId, setActorId } from "@/lib/currentUser";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { CaretDown, UserCircle } from "@phosphor-icons/react";

export default function UserPicker() {
  const [team, setTeam] = useState([]);
  const [actor, setActor] = useState(getActorId());

  useEffect(() => {
    fetchTeam().then(setTeam);
    const handler = () => setActor(getActorId());
    window.addEventListener("actor-changed", handler);
    return () => window.removeEventListener("actor-changed", handler);
  }, []);

  const current = team.find((t) => t.id === actor);

  const pick = (id) => {
    setActorId(id);
    setActor(id);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-2 px-2 py-1 rounded-sm border border-slate-200 hover:border-[#0033CC] hover:bg-slate-50 transition-colors"
          data-testid="user-picker"
        >
          {current ? (
            <div
              className="w-6 h-6 rounded-sm flex items-center justify-center text-[10px] font-bold text-white font-mono"
              style={{ backgroundColor: current.avatar_color || "#0033CC" }}
            >
              {current.name.slice(0, 2).toUpperCase()}
            </div>
          ) : (
            <UserCircle size={20} weight="duotone" className="text-slate-500" />
          )}
          <div className="text-left">
            <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500 leading-none">
              Acting as
            </div>
            <div className="text-xs font-semibold text-slate-900 leading-tight">
              {current ? current.name : "Guest"}
            </div>
          </div>
          <CaretDown size={12} weight="bold" className="text-slate-400" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 max-h-80 overflow-y-auto">
        <DropdownMenuLabel className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
          Identify yourself
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => pick("")}
          data-testid="user-picker-guest"
        >
          <UserCircle size={14} className="mr-2" /> Guest
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {team.map((t) => (
          <DropdownMenuItem
            key={t.id}
            onClick={() => pick(t.id)}
            data-testid={`user-picker-${t.id}`}
          >
            <div
              className="w-5 h-5 rounded-sm flex items-center justify-center text-[9px] font-bold text-white font-mono mr-2"
              style={{ backgroundColor: t.avatar_color || "#0033CC" }}
            >
              {t.name.slice(0, 2).toUpperCase()}
            </div>
            <span className="flex-1">{t.name}</span>
            <span className="text-[10px] text-slate-500 ml-2">{t.role}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
