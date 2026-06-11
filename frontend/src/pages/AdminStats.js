import { useState, useEffect } from "react";
import api from "../lib/api";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { 
  BarChart3, Building2, Users, FileText, Key, TrendingUp, 
  Loader2, RefreshCw, UserPlus, FolderPlus, Calendar
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";


export default function AdminStats() {
  const { isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (!isSuperAdmin) {
      navigate("/admin/login");
      return;
    }
    fetchStats();
  }, [isSuperAdmin, navigate]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/admin/system-stats`);
      setStats(response.data);
    } catch (err) {
      toast.error("Fehler beim Laden der Statistiken");
    } finally {
      setLoading(false);
    }
  };

  if (loading || !stats) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <BarChart3 className="w-7 h-7 text-purple-400" />
            System-Statistiken
          </h1>
          <p className="text-slate-400 mt-1">
            Übersicht über alle System-Metriken
          </p>
        </div>
        <Button onClick={fetchStats} variant="outline" disabled={loading} className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Aktualisieren
        </Button>
      </div>

      {/* Total Stats */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-400" />
          Gesamtzahlen
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-600 to-blue-700 border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm">Organisationen</p>
                  <p className="text-4xl font-bold text-white">{stats.totals.organizations}</p>
                </div>
                <Building2 className="w-12 h-12 text-blue-200 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-600 to-green-700 border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm">Benutzer</p>
                  <p className="text-4xl font-bold text-white">{stats.totals.users}</p>
                </div>
                <Users className="w-12 h-12 text-green-200 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-600 to-purple-700 border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-sm">Vorgänge</p>
                  <p className="text-4xl font-bold text-white">{stats.totals.cases}</p>
                </div>
                <FileText className="w-12 h-12 text-purple-200 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-orange-600 to-orange-700 border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-100 text-sm">Templates</p>
                  <p className="text-4xl font-bold text-white">{stats.totals.templates}</p>
                </div>
                <FileText className="w-12 h-12 text-orange-200 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Active Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Key className="w-5 h-5 text-purple-400" />
              Lizenz-Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-slate-700 rounded-lg">
                <span className="text-slate-300">Gesamt Lizenzen</span>
                <span className="text-xl font-bold text-white">{stats.licenses.total}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-green-900/30 rounded-lg border border-green-700">
                <span className="text-green-300">Verfügbar</span>
                <span className="text-xl font-bold text-green-400">{stats.licenses.unused}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-blue-900/30 rounded-lg border border-blue-700">
                <span className="text-blue-300">Aktiv</span>
                <span className="text-xl font-bold text-blue-400">{stats.licenses.active}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-purple-400" />
              Letzte Aktivität
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-slate-700 rounded-lg">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-400" />
                  <span className="text-slate-300">Neue Orgs (30 Tage)</span>
                </div>
                <span className="text-xl font-bold text-white">{stats.recent.new_orgs_30d}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-700 rounded-lg">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-green-400" />
                  <span className="text-slate-300">Neue Benutzer (30 Tage)</span>
                </div>
                <span className="text-xl font-bold text-white">{stats.recent.new_users_30d}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-700 rounded-lg">
                <div className="flex items-center gap-2">
                  <FolderPlus className="w-4 h-4 text-purple-400" />
                  <span className="text-slate-300">Neue Vorgänge (7 Tage)</span>
                </div>
                <span className="text-xl font-bold text-white">{stats.recent.new_cases_7d}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Case Types Distribution */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-purple-400" />
            Vorgangs-Verteilung
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-blue-900/30 rounded-lg border border-blue-700 text-center">
              <p className="text-blue-300 text-sm mb-1">Onboardings</p>
              <p className="text-3xl font-bold text-blue-400">{stats.case_types.onboarding}</p>
              <p className="text-xs text-blue-400/70 mt-1">
                {stats.totals.cases > 0 ? Math.round((stats.case_types.onboarding / stats.totals.cases) * 100) : 0}%
              </p>
            </div>
            <div className="p-4 bg-purple-900/30 rounded-lg border border-purple-700 text-center">
              <p className="text-purple-300 text-sm mb-1">Offboardings</p>
              <p className="text-3xl font-bold text-purple-400">{stats.case_types.offboarding}</p>
              <p className="text-xs text-purple-400/70 mt-1">
                {stats.totals.cases > 0 ? Math.round((stats.case_types.offboarding / stats.totals.cases) * 100) : 0}%
              </p>
            </div>
            <div className="p-4 bg-orange-900/30 rounded-lg border border-orange-700 text-center">
              <p className="text-orange-300 text-sm mb-1">Rollenwechsel</p>
              <p className="text-3xl font-bold text-orange-400">{stats.case_types.rolechange}</p>
              <p className="text-xs text-orange-400/70 mt-1">
                {stats.totals.cases > 0 ? Math.round((stats.case_types.rolechange / stats.totals.cases) * 100) : 0}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Generated Timestamp */}
      <p className="text-sm text-slate-500 text-right">
        Zuletzt aktualisiert: {new Date(stats.generated_at).toLocaleString("de-DE")}
      </p>
    </div>
  );
}
