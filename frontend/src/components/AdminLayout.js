import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Shield, Key, Building2, LogOut, LayoutDashboard, Users, BarChart3, ScrollText } from "lucide-react";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "./ui/dropdown-menu";

const adminNavItems = [
  { to: "/admin", icon: LayoutDashboard, label: "Lizenzen & Orgs", end: true },
  { to: "/admin/users", icon: Users, label: "Benutzer" },
  { to: "/admin/stats", icon: BarChart3, label: "Statistiken" },
  { to: "/admin/audit-log", icon: ScrollText, label: "Audit-Log" },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/admin/login");
  };

  const initials = user?.name?.split(" ").map(n => n[0]).join("").toUpperCase() || "SA";

  return (
    <div className="min-h-screen bg-slate-900 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-800 border-r border-slate-700 flex flex-col fixed h-full">
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">System Admin</h1>
              <p className="text-xs text-slate-400">Onboarding-Automat</p>
            </div>
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          {adminNavItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-purple-600 text-white"
                    : "text-slate-300 hover:bg-slate-700 hover:text-white"
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          ))}

        </nav>

        {/* User Info */}
        <div className="p-4 border-t border-slate-700">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="w-full justify-start gap-3 text-white hover:bg-slate-700">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-purple-600 text-white text-sm font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="text-left flex-1">
                  <p className="text-sm font-medium text-white truncate">{user?.name}</p>
                  <p className="text-xs text-slate-400 truncate">{user?.email}</p>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-3 py-2 border-b">
                <p className="text-sm font-medium">{user?.name}</p>
                <p className="text-xs text-slate-500">{user?.email}</p>
                <span className="mt-1 inline-block px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-semibold rounded">
                  Super Admin
                </span>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => navigate("/login")} 
                className="cursor-pointer"
              >
                <Users className="w-4 h-4 mr-2" />
                Zur Haupt-App
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={handleLogout} 
                className="text-red-600 cursor-pointer"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Abmelden
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 ml-64">
        {/* Header */}
        <header className="sticky top-0 z-30 px-8 py-4 bg-slate-800/80 backdrop-blur border-b border-slate-700 flex items-center justify-between">
          <div className="text-white">
            <h2 className="text-lg font-semibold">Systemverwaltung</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-purple-600/20 text-purple-300 text-xs font-semibold rounded-full border border-purple-500/30">
              Admin-Bereich
            </span>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
