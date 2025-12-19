import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
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
import EvidencePolicies from "./pages/EvidencePolicies";
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

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;
  if (!user) return <Navigate to="/login" />;
  return children;
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
          <Route path="/home" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
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
          
          {/* Main App Routes */}
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
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
            <Route path="evidence-policies" element={<EvidencePolicies />} />
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
