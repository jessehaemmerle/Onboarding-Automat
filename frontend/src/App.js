import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import ChangePassword from "./pages/ChangePassword";
import RegisterOrganization from "./pages/RegisterOrganization";
import LandingPage from "./pages/LandingPage";
import Dashboard from "./pages/Dashboard";
import Cases from "./pages/Cases";
import CaseDetail from "./pages/CaseDetail";
import NewOnboarding from "./pages/NewOnboarding";
import NewOffboarding from "./pages/NewOffboarding";
import NewRoleChange from "./pages/NewRoleChange";
import Templates from "./pages/Templates";
import TemplateEditor from "./pages/TemplateEditor";
import Settings from "./pages/Settings";
import Analytics from "./pages/Analytics";
import EvidencePolicies from "./pages/EvidencePolicies";
import Billing from "./pages/Billing";
import AuditLog from "./pages/AuditLog";
import PrivacyCenter from "./pages/PrivacyCenter";
import Datenschutz from "./pages/Datenschutz";
import Impressum from "./pages/Impressum";
import Kontakt from "./pages/Kontakt";
import OrgUserManagement from "./pages/OrgUserManagement";
import AdminPanel from "./pages/AdminPanel";
import AdminLogin from "./pages/AdminLogin";
import AdminUsers from "./pages/AdminUsers";
import AdminStats from "./pages/AdminStats";
import AdminAuditLog from "./pages/AdminAuditLog";
import Layout from "./components/Layout";
import AdminLayout from "./components/AdminLayout";
import CookieBanner from "./components/CookieBanner";

const Spinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
  </div>
);

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" />;
  // Force initial password change before accessing the app
  if (user.must_change_password && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" />;
  }
  return children;
};

// Root shell: anonymous visitors get the public landing page at "/",
// authenticated users get the app (Layout + nested routes). Any other
// app path falls back to the login redirect for anonymous visitors.
const AppShell = () => {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner />;
  if (!user) {
    if (location.pathname === "/") return <LandingPage />;
    return <Navigate to="/login" replace />;
  }
  if (user.must_change_password && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }
  return <Layout />;
};

// Route für Super-Admin-Bereich
const SuperAdminRoute = ({ children }) => {
  const { user, loading, isSuperAdmin } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-900"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div></div>;
  if (!user) return <Navigate to="/admin/login" />;
  if (!isSuperAdmin) return <Navigate to="/admin/login" />;
  return children;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/home" element={<Navigate to="/" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/change-password" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />
          <Route path="/register-organization" element={<RegisterOrganization />} />
          <Route path="/datenschutz" element={<Datenschutz />} />
          <Route path="/impressum" element={<Impressum />} />
          <Route path="/kontakt" element={<Kontakt />} />
          
          {/* Admin Routes - Separate vom Rest der Anwendung */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<SuperAdminRoute><AdminLayout /></SuperAdminRoute>}>
            <Route index element={<AdminPanel />} />
            <Route path="dashboard" element={<AdminPanel />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="stats" element={<AdminStats />} />
            <Route path="audit-log" element={<AdminAuditLog />} />
          </Route>
          
          {/* Main App Routes — landing for anon, dashboard for authed users */}
          <Route path="/" element={<AppShell />}>
            <Route index element={<Dashboard />} />
            <Route path="cases" element={<Cases />} />
            <Route path="cases/:id" element={<CaseDetail />} />
            <Route path="new-onboarding" element={<NewOnboarding />} />
            <Route path="new-offboarding" element={<NewOffboarding />} />
            <Route path="new-rolechange" element={<NewRoleChange />} />
            <Route path="templates" element={<Templates />} />
            <Route path="templates/:id" element={<TemplateEditor />} />
            <Route path="templates/new" element={<TemplateEditor />} />
            <Route path="settings" element={<Settings />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="evidence-policies" element={<EvidencePolicies />} />
            <Route path="billing" element={<Billing />} />
            <Route path="user-management" element={<OrgUserManagement />} />
            <Route path="audit-log" element={<AuditLog />} />
            <Route path="privacy" element={<PrivacyCenter />} />
          </Route>
        </Routes>
        <Toaster position="top-right" richColors />
        <CookieBanner />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
