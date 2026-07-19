import { NavLink } from "react-router-dom";
import { Home, Baby, Calendar, HandHeart, User } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/kids/parent", icon: Home, label: "Início", end: true },
  { to: "/kids/parent/filhos", icon: Baby, label: "Filhos" },
  { to: "/kids/parent/agenda", icon: Calendar, label: "Agenda" },
  { to: "/kids/parent/oracao", icon: HandHeart, label: "Oração" },
  { to: "/kids/parent/perfil", icon: User, label: "Perfil" },
];

export function ParentBottomNav() {
  return (
    <nav className="fixed bottom-3 left-3 right-3 z-40 pk-pill flex items-center justify-around px-2 py-1.5 max-w-md mx-auto">
      {items.map((it) => (
        <NavLink
          key={it.to}
          to={it.to}
          end={it.end}
          className={({ isActive }) =>
            cn(
              "flex flex-col items-center gap-0.5 px-3 py-2 rounded-2xl text-[10px] font-bold transition-all",
              isActive
                ? "bg-gradient-to-br from-pink-400 to-purple-500 text-white scale-105 shadow-lg"
                : "opacity-70 hover:opacity-100",
            )
          }
        >
          <it.icon className="w-5 h-5" />
          {it.label}
        </NavLink>
      ))}
    </nav>
  );
}
