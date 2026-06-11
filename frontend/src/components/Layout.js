import { useState, useEffect } from "react";
import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import OnboardingWizard from "./OnboardingWizard";
import { useKeyboardShortcuts, SHORTCUTS } from "../hooks/useKeyboardShortcuts";
import api from "../lib/api";
import {
  LayoutDashboard, Users, FolderKanban, Settings, LogOut, Plus,
  FileText, ScrollText, Shield, UserMinus, RefreshCw, ChevronDown,
  CreditCard, Menu, X, BarChart2,
} from "lucide-react";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback } from "./ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from "./ui/dropdown-menu";

// Map route paths to human-readable breadcrumb labels
const BREADCRUMB_LABELS = {
  "/": "Dashboard",
  "/cases": "Vorgänge",
  "/templates": "Templates",
  "/settings": "Einstellungen",
  "/user-management": "Benutzerverwaltung",
  "/evidence-policies": "Nachweis-Richtlinien",
  "/billing": "Abrechnung",
  "/analytics": "Analytics",
  "/audit-log": "Audit-Log",
  "/privacy": "Datenschutzcenter",
  "/new-onboarding": "Neues Onboarding",
  "/new-offboarding": "Neues Offboarding",
  "/new-rolechange": "Neuer Rollenwechsel",
};

function useBreadcrumb() {
  const location = useLocation();
  const path = location.pathname;
  if (path.startsWith("/cases/")) return "Vorgangsdetail";
  if (path.startsWith("/templates/")) return "Template bearbeiten";
  return BREADCRUMB_LABELS[path] || null;
}

export default function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const breadcrumb = useBreadcrumb();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  useKeyboardShortcuts({ onToggleHelp: setShowShortcuts });

  useEffect(() => {
    if (localStorage.getItem("wizard_done")) return;
    // Show wizard only if org has no templates yet
    api.get("/templates").then(res => {
      if (res.data.length === 0) setShowWizard(true);
    }).catch(() => {});
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const initials = user?.name?.split(" ").map((n) => n[0]).join("").toUpperCase() || "U";

  const navItems = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard },
    { to: "/cases", label: "Vorgänge", icon: Users },
    { to: "/templates", label: "Templates", icon: FolderKanban },
    { to: "/analytics", label: "Analytics", icon: BarChart2 },
    { to: "/settings", label: "Einstellungen", icon: Settings },
  ];

  const adminNavItems = isAdmin
    ? [
        { to: "/user-management", label: "Benutzerverwaltung", icon: Users },
        { to: "/evidence-policies", label: "Nachweis-Richtlinien", icon: Shield },
        { to: "/audit-log", label: "Audit-Log", icon: ScrollText },
        { to: "/billing", label: "Abrechnung", icon: CreditCard },
      ]
    : [];

  const SidebarContent = () => (
    <>
      <div className="p-6 border-b border-slate-100">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">OnboardIQ</h1>
        <p className="text-xs text-slate-500 mt-1">HR-Automatisierung</p>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`
            }
            data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
          >
            <item.icon className="w-5 h-5 shrink-0" />
            {item.label}
          </NavLink>
        ))}

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
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "bg-purple-50 text-purple-700"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`
                }
                data-testid="nav-admin"
              >
                <item.icon className="w-5 h-5 shrink-0" />
                {item.label}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      <div className="p-4 border-t border-slate-100 space-y-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="w-full btn-primary gap-2" data-testid="new-case-dropdown">
              <Plus className="w-4 h-4" />
              Neuer Vorgang
              <ChevronDown className="w-4 h-4 ml-auto" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-56">
            <DropdownMenuItem
              onClick={() => { navigate("/new-onboarding"); setSidebarOpen(false); }}
              className="cursor-pointer"
              data-testid="new-onboarding-btn"
            >
              <Users className="w-4 h-4 mr-2 text-blue-600" />
              Onboarding
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => { navigate("/new-offboarding"); setSidebarOpen(false); }}
              className="cursor-pointer"
              data-testid="new-offboarding-btn"
            >
              <UserMinus className="w-4 h-4 mr-2 text-purple-600" />
              Offboarding
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => { navigate("/new-rolechange"); setSidebarOpen(false); }}
              className="cursor-pointer"
              data-testid="new-rolechange-btn"
            >
              <RefreshCw className="w-4 h-4 mr-2 text-orange-600" />
              Rollenwechsel
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col fixed h-full z-40 hidden md:flex">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar Drawer */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-white border-r border-slate-200 flex flex-col z-50 transform transition-transform duration-300 md:hidden ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="absolute top-4 right-4">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </Button>
        </div>
        <SidebarContent />
      </aside>

      {/* Main Content */}
      <div className="flex-1 md:ml-64">
        {/* Header */}
        <header className="glass-header sticky top-0 z-30 px-4 md:px-8 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {/* Hamburger — mobile only */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden shrink-0"
              onClick={() => setSidebarOpen(true)}
              aria-label="Menü öffnen"
            >
              <Menu className="w-5 h-5" />
            </Button>

            {/* Breadcrumb */}
            {breadcrumb && (
              <div className="hidden sm:flex items-center gap-2 min-w-0">
                <span className="text-slate-400 text-sm">/</span>
                <span className="text-sm font-medium text-slate-700 truncate">{breadcrumb}</span>
              </div>
            )}
          </div>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2 shrink-0" data-testid="user-menu">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-blue-100 text-blue-700 text-sm font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="text-left hidden sm:block">
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
              <DropdownMenuItem
                onClick={() => navigate("/privacy")}
                className="cursor-pointer"
                data-testid="privacy-center-btn"
              >
                <Shield className="w-4 h-4 mr-2" />
                Datenschutz
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-red-600 cursor-pointer"
                data-testid="logout-btn"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Abmelden
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Page Content */}
        <main className="p-4 md:p-8">
          <Outlet />
        </main>
      </div>

      {/* First-time setup wizard */}
      <OnboardingWizard open={showWizard} onClose={() => setShowWizard(false)} />

      {/* Keyboard shortcuts overlay */}
      {showShortcuts && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
          onClick={() => setShowShortcuts(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl p-6 w-80 max-w-full"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Tastaturkürzel</h3>
            <div className="space-y-2">
              {SHORTCUTS.filter(s => s.path).map(s => (
                <div key={s.keys.join("+")} className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">{s.label}</span>
                  <div className="flex items-center gap-1">
                    {s.keys.map((k, i) => (
                      <span key={i}>
                        <kbd className="px-2 py-0.5 bg-slate-100 border border-slate-300 rounded text-xs font-mono text-slate-700">{k}</kbd>
                        {i < s.keys.length - 1 && <span className="text-slate-400 text-xs mx-0.5">then</span>}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="text-sm text-slate-600">Dieses Fenster schließen</span>
                <kbd className="px-2 py-0.5 bg-slate-100 border border-slate-300 rounded text-xs font-mono text-slate-700">Esc</kbd>
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-4 text-center">Drücken Sie <kbd className="px-1 bg-slate-100 rounded">?</kbd> um dieses Fenster zu öffnen</p>
          </div>
        </div>
      )}
    </div>
  );
}
