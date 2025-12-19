import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { LayoutDashboard, Users, FolderKanban, Settings, LogOut, Plus, FileText, ScrollText, Shield, UserMinus, RefreshCw, ChevronDown, Key } from "lucide-react";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "./ui/dropdown-menu";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/cases", icon: Users, label: "Onboardings" },
  { to: "/templates", icon: FileText, label: "Templates", adminOnly: true },
  { to: "/audit-log", icon: ScrollText, label: "Audit-Log", adminOnly: true },
  { to: "/settings", icon: Settings, label: "Einstellungen", adminOnly: true },
];

export default function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const initials = user?.name?.split(" ").map(n => n[0]).join("").toUpperCase() || "U";

  const navItems = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard },
    { to: "/cases", label: "Vorgänge", icon: Users },
    { to: "/templates", label: "Templates", icon: FolderKanban },
    { to: "/settings", label: "Einstellungen", icon: Settings },
  ];

  // Admin-Navigation für Organisations-Admins (Benutzerverwaltung)
  const adminNavItems = isAdmin ? [
    { to: "/user-management", label: "Benutzerverwaltung", icon: Users },
  ] : [];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col fixed h-full">
        <div className="p-6 border-b border-slate-100">
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">OnboardIQ</h1>
          <p className="text-xs text-slate-500 mt-1">HR-Automatisierung</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`
              }
              data-testid={`nav-${item.label.toLowerCase()}`}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          ))}

          {/* Admin Section */}
          {adminNavItems.length > 0 && (
            <>
              <div className="my-4 border-t border-slate-200" />
              <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Administration
              </div>
              {adminNavItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? "bg-purple-50 text-purple-700"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`
                  }
                  data-testid={`nav-admin`}
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </NavLink>
              ))}
            </>
          )}
        </nav>

        <div className="p-4 border-t border-slate-100 space-y-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                className="w-full btn-primary gap-2"
                data-testid="new-case-dropdown"
              >
                <Plus className="w-4 h-4" />
                Neuer Vorgang
                <ChevronDown className="w-4 h-4 ml-auto" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-56">
              <DropdownMenuItem 
                onClick={() => navigate("/new-onboarding")} 
                className="cursor-pointer"
                data-testid="new-onboarding-btn"
              >
                <Users className="w-4 h-4 mr-2 text-blue-600" />
                Onboarding
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => navigate("/new-offboarding")} 
                className="cursor-pointer"
                data-testid="new-offboarding-btn"
              >
                <UserMinus className="w-4 h-4 mr-2 text-purple-600" />
                Offboarding
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => navigate("/new-rolechange")} 
                className="cursor-pointer"
                data-testid="new-rolechange-btn"
              >
                <RefreshCw className="w-4 h-4 mr-2 text-orange-600" />
                Rollenwechsel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 ml-64">
        {/* Header */}
        <header className="glass-header sticky top-0 z-30 px-8 py-4 flex items-center justify-between">
          <div />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2" data-testid="user-menu">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-blue-100 text-blue-700 text-sm font-semibold">{initials}</AvatarFallback>
                </Avatar>
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-700">{user?.name}</span>
                    {user?.is_super_admin && (
                      <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs font-semibold rounded">
                        SA
                      </span>
                    )}
                  </div>
                  {user?.organization_name && (
                    <span className="text-xs text-slate-500">🏢 {user.organization_name}</span>
                  )}
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <div className="px-3 py-2 border-b border-slate-100">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-medium text-slate-900">{user?.name}</p>
                  {user?.is_super_admin && (
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-semibold rounded">
                      Super Admin
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500">{user?.email}</p>
                {user?.organization_name && (
                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                    <span>🏢</span> {user.organization_name}
                  </p>
                )}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/privacy")} className="cursor-pointer" data-testid="privacy-center-btn">
                <Shield className="w-4 h-4 mr-2" />
                Datenschutz
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-red-600 cursor-pointer" data-testid="logout-btn">
                <LogOut className="w-4 h-4 mr-2" />
                Abmelden
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Page Content */}
        <main className="p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
