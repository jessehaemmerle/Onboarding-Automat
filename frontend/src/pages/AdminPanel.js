import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Badge } from "../components/ui/badge";
import { 
  Key, Building2, Users, Shield, Loader2, Copy, CheckCircle, 
  XCircle, RefreshCw, Plus, AlertTriangle, TrendingUp 
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AdminPanel() {
  const { user, isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [licenses, setLicenses] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [stats, setStats] = useState({ total: 0, unused: 0, active: 0 });

  // License generation form
  const [licenseForm, setLicenseForm] = useState({
    count: 1,
    user_limit: 10,
    notes: "",
  });

  useEffect(() => {
    if (!isSuperAdmin) {
      toast.error("Keine Berechtigung - Nur für Super-Administratoren");
      navigate("/admin/login");
      return;
    }
    fetchData();
  }, [isSuperAdmin, navigate]);

  const fetchData = async () => {
    try {
      setLoading(true);
      await Promise.all([fetchLicenses(), fetchOrganizations()]);
    } catch (err) {
      toast.error("Fehler beim Laden der Daten");
    } finally {
      setLoading(false);
    }
  };

  const fetchLicenses = async () => {
    try {
      // We need to fetch from MongoDB directly or create a new endpoint
      // For now, we'll create a new endpoint
      const response = await axios.get(`${API}/admin/licenses`);
      setLicenses(response.data);
      
      const unused = response.data.filter(l => l.status === 'unused').length;
      const active = response.data.filter(l => l.status === 'active').length;
      setStats({ total: response.data.length, unused, active });
    } catch (err) {
      console.error("Error fetching licenses:", err);
    }
  };

  const fetchOrganizations = async () => {
    try {
      const response = await axios.get(`${API}/admin/organizations`);
      setOrganizations(response.data);
    } catch (err) {
      console.error("Error fetching organizations:", err);
    }
  };

  const generateLicenses = async () => {
    setLoading(true);
    try {
      const masterKey = prompt("Bitte geben Sie den MASTER_ADMIN_KEY ein:");
      if (!masterKey) {
        toast.error("Master-Key erforderlich");
        return;
      }

      const response = await axios.post(
        `${API}/admin/generate-license-keys`,
        licenseForm,
        { headers: { "X-Master-Key": masterKey } }
      );

      toast.success(`${response.data.length} Lizenzschlüssel erfolgreich generiert!`);
      setLicenseForm({ count: 1, user_limit: 10, notes: "" });
      await fetchLicenses();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Fehler beim Generieren");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success("In Zwischenablage kopiert!");
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <div className="space-y-6" data-testid="admin-panel">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <Shield className="w-8 h-8 text-purple-600" />
            System Administration
          </h1>
          <p className="text-slate-500 mt-1">
            Verwaltung von Lizenzen, Organisationen und System-Einstellungen
          </p>
        </div>
        <Button onClick={fetchData} variant="outline" disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Aktualisieren
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Gesamt Lizenzen</p>
                <p className="text-3xl font-bold text-slate-900">{stats.total}</p>
              </div>
              <Key className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Verfügbar</p>
                <p className="text-3xl font-bold text-green-600">{stats.unused}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Aktiv</p>
                <p className="text-3xl font-bold text-blue-600">{stats.active}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Organisationen</p>
                <p className="text-3xl font-bold text-purple-600">{organizations.length}</p>
              </div>
              <Building2 className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="generate" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="generate">Lizenzen Generieren</TabsTrigger>
          <TabsTrigger value="licenses">Lizenz-Übersicht</TabsTrigger>
          <TabsTrigger value="organizations">Organisationen</TabsTrigger>
        </TabsList>

        {/* Generate Licenses Tab */}
        <TabsContent value="generate" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Neue Lizenzschlüssel Generieren
              </CardTitle>
              <CardDescription>
                Erstellen Sie neue Lizenzschlüssel für Kunden. Format: OA-XXXX-XXXX-XXXX
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="count">Anzahl *</Label>
                  <Input
                    id="count"
                    type="number"
                    min="1"
                    max="100"
                    value={licenseForm.count}
                    onChange={(e) => setLicenseForm({ ...licenseForm, count: parseInt(e.target.value) })}
                  />
                  <p className="text-xs text-slate-500">Wie viele Lizenzen sollen erstellt werden?</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="user_limit">Benutzer-Limit *</Label>
                  <Input
                    id="user_limit"
                    type="number"
                    min="1"
                    value={licenseForm.user_limit}
                    onChange={(e) => setLicenseForm({ ...licenseForm, user_limit: parseInt(e.target.value) })}
                  />
                  <p className="text-xs text-slate-500">Max. Anzahl Benutzer pro Lizenz</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notiz</Label>
                  <Input
                    id="notes"
                    placeholder="z.B. Kunde ABC GmbH"
                    value={licenseForm.notes}
                    onChange={(e) => setLicenseForm({ ...licenseForm, notes: e.target.value })}
                  />
                  <p className="text-xs text-slate-500">Optional: Kundenname oder Zweck</p>
                </div>
              </div>

              <div className="pt-4 border-t">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-slate-600">
                    <p>
                      Erstellt: <strong>{licenseForm.count}</strong> Lizenzen mit je{" "}
                      <strong>{licenseForm.user_limit}</strong> Benutzer-Limit
                    </p>
                  </div>
                  <Button onClick={generateLicenses} disabled={loading} className="gap-2">
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Generiere...
                      </>
                    ) : (
                      <>
                        <Key className="w-4 h-4" />
                        Lizenzen Generieren
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                  <div className="text-sm text-amber-800">
                    <p className="font-semibold mb-1">Wichtig:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Sie benötigen den MASTER_ADMIN_KEY aus der .env Datei</li>
                      <li>Generierte Lizenzen können nur einmal verwendet werden</li>
                      <li>Bewahren Sie die Lizenzschlüssel sicher auf</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Licenses List Tab */}
        <TabsContent value="licenses" className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            {/* Unused Licenses */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  Verfügbare Lizenzen ({stats.unused})
                </CardTitle>
                <CardDescription>Diese Lizenzen können an Kunden vergeben werden</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {licenses.filter(l => l.status === 'unused').length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-8">
                      Keine verfügbaren Lizenzen. Generieren Sie neue Lizenzen oben.
                    </p>
                  ) : (
                    licenses
                      .filter(l => l.status === 'unused')
                      .map((license) => (
                        <Card key={license.id} className="border-green-200 bg-green-50">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <code className="text-lg font-mono font-bold text-slate-900">
                                    {license.key}
                                  </code>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => copyToClipboard(license.key)}
                                  >
                                    <Copy className="w-4 h-4" />
                                  </Button>
                                  <Badge variant="success">Verfügbar</Badge>
                                </div>
                                <div className="flex gap-4 text-sm text-slate-600">
                                  <span>👥 {license.user_limit} Benutzer</span>
                                  <span>📅 {formatDate(license.created_at)}</span>
                                  {license.notes && <span>📝 {license.notes}</span>}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Active Licenses */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                  Aktive Lizenzen ({stats.active})
                </CardTitle>
                <CardDescription>Diese Lizenzen werden von Organisationen verwendet</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {licenses.filter(l => l.status === 'active').length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-8">
                      Noch keine aktiven Lizenzen
                    </p>
                  ) : (
                    licenses
                      .filter(l => l.status === 'active')
                      .map((license) => {
                        const org = organizations.find(o => o.id === license.organization_id);
                        return (
                          <Card key={license.id} className="border-blue-200 bg-blue-50">
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-3 mb-2">
                                    <code className="text-lg font-mono font-bold text-slate-900">
                                      {license.key}
                                    </code>
                                    <Badge>Aktiv</Badge>
                                  </div>
                                  <div className="space-y-1 text-sm text-slate-600">
                                    {org && (
                                      <div className="flex items-center gap-2">
                                        <Building2 className="w-4 h-4" />
                                        <span className="font-semibold">{org.name}</span>
                                        <span className="text-slate-400">
                                          ({org.user_count}/{license.user_limit} Benutzer)
                                        </span>
                                      </div>
                                    )}
                                    <div className="flex gap-4">
                                      <span>📅 Aktiviert: {formatDate(license.activated_at)}</span>
                                      {license.notes && <span>📝 {license.notes}</span>}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Organizations Tab */}
        <TabsContent value="organizations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Registrierte Organisationen ({organizations.length})
              </CardTitle>
              <CardDescription>Übersicht aller registrierten Firmen</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {organizations.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-8">
                    Noch keine Organisationen registriert
                  </p>
                ) : (
                  organizations.map((org) => (
                    <Card key={org.id} className="border-purple-200">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-lg font-semibold text-slate-900">{org.name}</h3>
                              <Badge variant={org.status === 'active' ? 'success' : 'secondary'}>
                                {org.status}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm text-slate-600">
                              <div>
                                <p className="text-slate-500 text-xs">Lizenzschlüssel</p>
                                <code className="font-mono">{org.license_key}</code>
                              </div>
                              <div>
                                <p className="text-slate-500 text-xs">Benutzer</p>
                                <p className="font-semibold">
                                  {org.user_count} / {org.user_limit}
                                  {org.user_count >= org.user_limit && (
                                    <span className="text-amber-600 ml-2">(Limit erreicht)</span>
                                  )}
                                </p>
                              </div>
                              <div>
                                <p className="text-slate-500 text-xs">Erstellt</p>
                                <p>{formatDate(org.created_at)}</p>
                              </div>
                              <div>
                                <p className="text-slate-500 text-xs">Cases</p>
                                <p className="font-semibold">{org.case_count || 0}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
