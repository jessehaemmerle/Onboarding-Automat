import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../components/ui/dialog";
import { 
  Key, Building2, Users, Shield, Loader2, Copy, CheckCircle, 
  XCircle, RefreshCw, Plus, AlertTriangle, TrendingUp, Edit, Trash2,
  Ban, RotateCcw, UserPlus, Calendar, MoreHorizontal, Settings
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
  const [stats, setStats] = useState({ total: 0, unused: 0, active: 0, revoked: 0 });

  // License generation form
  const [licenseForm, setLicenseForm] = useState({
    count: 1,
    user_limit: 10,
    notes: "",
  });

  // Edit license dialog
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingLicense, setEditingLicense] = useState(null);
  const [editForm, setEditForm] = useState({
    user_limit: 10,
    notes: "",
    expires_at: ""
  });

  // Add users dialog
  const [showAddUsersDialog, setShowAddUsersDialog] = useState(false);
  const [addUsersLicense, setAddUsersLicense] = useState(null);
  const [additionalUsers, setAdditionalUsers] = useState(5);

  // Revoke dialog
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);
  const [revokeLicense, setRevokeLicense] = useState(null);
  const [revokeReason, setRevokeReason] = useState("");

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
      const response = await axios.get(`${API}/admin/licenses`);
      setLicenses(response.data);
      
      const unused = response.data.filter(l => l.status === 'unused').length;
      const active = response.data.filter(l => l.status === 'active').length;
      const revoked = response.data.filter(l => l.status === 'revoked').length;
      setStats({ total: response.data.length, unused, active, revoked });
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

  const openEditDialog = (license) => {
    setEditingLicense(license);
    setEditForm({
      user_limit: license.user_limit,
      notes: license.notes || "",
      expires_at: license.expires_at ? license.expires_at.split("T")[0] : ""
    });
    setShowEditDialog(true);
  };

  const saveEditedLicense = async () => {
    try {
      await axios.put(`${API}/admin/licenses/${editingLicense.id}`, null, {
        params: {
          user_limit: editForm.user_limit,
          notes: editForm.notes,
          expires_at: editForm.expires_at || null
        }
      });
      toast.success("Lizenz aktualisiert");
      setShowEditDialog(false);
      fetchLicenses();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Fehler beim Speichern");
    }
  };

  const openAddUsersDialog = (license) => {
    setAddUsersLicense(license);
    setAdditionalUsers(5);
    setShowAddUsersDialog(true);
  };

  const addUsersToLicense = async () => {
    try {
      const response = await axios.post(
        `${API}/admin/licenses/${addUsersLicense.id}/add-users`,
        null,
        { params: { additional_users: additionalUsers } }
      );
      toast.success(`Benutzer-Limit erhöht auf ${response.data.new_limit}`);
      setShowAddUsersDialog(false);
      fetchLicenses();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Fehler beim Hinzufügen");
    }
  };

  const openRevokeDialog = (license) => {
    setRevokeLicense(license);
    setRevokeReason("");
    setShowRevokeDialog(true);
  };

  const handleRevokeLicense = async () => {
    try {
      await axios.patch(
        `${API}/admin/licenses/${revokeLicense.id}/revoke`,
        null,
        { params: { reason: revokeReason } }
      );
      toast.success("Lizenz widerrufen");
      setShowRevokeDialog(false);
      fetchLicenses();
      fetchOrganizations();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Fehler beim Widerrufen");
    }
  };

  const reactivateLicense = async (license) => {
    if (!window.confirm("Lizenz wirklich reaktivieren?")) return;
    try {
      await axios.patch(`${API}/admin/licenses/${license.id}/reactivate`);
      toast.success("Lizenz reaktiviert");
      fetchLicenses();
      fetchOrganizations();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Fehler beim Reaktivieren");
    }
  };

  const deleteLicense = async (license) => {
    if (!window.confirm(`Lizenz ${license.key} wirklich löschen? Dies kann nicht rückgängig gemacht werden.`)) return;
    try {
      await axios.delete(`${API}/admin/licenses/${license.id}`, {
        params: { confirm: true }
      });
      toast.success("Lizenz gelöscht");
      fetchLicenses();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Fehler beim Löschen");
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success("In Zwischenablage kopiert!");
  };

  const formatDate = (dateString) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "unused":
        return <Badge className="bg-green-100 text-green-800">Verfügbar</Badge>;
      case "active":
        return <Badge className="bg-blue-100 text-blue-800">Aktiv</Badge>;
      case "revoked":
        return <Badge className="bg-red-100 text-red-800">Widerrufen</Badge>;
      case "expired":
        return <Badge className="bg-orange-100 text-orange-800">Abgelaufen</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
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
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
                <p className="text-sm text-slate-500">Widerrufen</p>
                <p className="text-3xl font-bold text-red-600">{stats.revoked}</p>
              </div>
              <Ban className="w-8 h-8 text-red-600" />
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
      <Tabs defaultValue="licenses" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="licenses">Lizenz-Verwaltung</TabsTrigger>
          <TabsTrigger value="generate">Lizenzen Generieren</TabsTrigger>
          <TabsTrigger value="organizations">Organisationen</TabsTrigger>
        </TabsList>

        {/* Licenses Management Tab */}
        <TabsContent value="licenses" className="space-y-4">
          {/* Active Licenses */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                Aktive Lizenzen ({stats.active})
              </CardTitle>
              <CardDescription>Lizenzen, die Organisationen zugewiesen sind</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {licenses.filter(l => l.status === 'active').length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-8">Keine aktiven Lizenzen</p>
                ) : (
                  licenses.filter(l => l.status === 'active').map((license) => (
                    <Card key={license.id} className="border-blue-200">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <code className="text-lg font-mono font-bold">{license.key}</code>
                              {getStatusBadge(license.status)}
                              <Button variant="ghost" size="icon" onClick={() => copyToClipboard(license.key)}>
                                <Copy className="w-4 h-4" />
                              </Button>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <span className="text-slate-500">Organisation:</span>
                                <p className="font-medium">{license.organization_name || "—"}</p>
                              </div>
                              <div>
                                <span className="text-slate-500">Benutzer:</span>
                                <p className="font-medium">
                                  {license.current_users || 0} / {license.user_limit === -1 ? "∞" : license.user_limit}
                                </p>
                              </div>
                              <div>
                                <span className="text-slate-500">Aktiviert:</span>
                                <p className="font-medium">{formatDate(license.activated_at)}</p>
                              </div>
                              <div>
                                <span className="text-slate-500">Läuft ab:</span>
                                <p className="font-medium">{formatDate(license.expires_at)}</p>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2 ml-4">
                            <Button variant="outline" size="sm" onClick={() => openAddUsersDialog(license)}>
                              <UserPlus className="w-4 h-4 mr-1" />
                              +Benutzer
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => openEditDialog(license)}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700" onClick={() => openRevokeDialog(license)}>
                              <Ban className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Unused Licenses */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Verfügbare Lizenzen ({stats.unused})
              </CardTitle>
              <CardDescription>Lizenzen, die an Kunden vergeben werden können</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {licenses.filter(l => l.status === 'unused').length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-8">
                    Keine verfügbaren Lizenzen. Generieren Sie neue Lizenzen.
                  </p>
                ) : (
                  licenses.filter(l => l.status === 'unused').map((license) => (
                    <div key={license.id} className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        <code className="font-mono font-bold">{license.key}</code>
                        <Badge variant="secondary">{license.user_limit} Benutzer</Badge>
                        {license.notes && <span className="text-sm text-slate-500">{license.notes}</span>}
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => copyToClipboard(license.key)}>
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(license)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-red-600" onClick={() => deleteLicense(license)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Revoked Licenses */}
          {stats.revoked > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Ban className="w-5 h-5 text-red-600" />
                  Widerrufene Lizenzen ({stats.revoked})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {licenses.filter(l => l.status === 'revoked').map((license) => (
                    <div key={license.id} className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
                      <div>
                        <div className="flex items-center gap-3">
                          <code className="font-mono">{license.key}</code>
                          {getStatusBadge(license.status)}
                        </div>
                        {license.revocation_reason && (
                          <p className="text-sm text-slate-500 mt-1">Grund: {license.revocation_reason}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => reactivateLicense(license)}>
                          <RotateCcw className="w-4 h-4 mr-1" />
                          Reaktivieren
                        </Button>
                        <Button variant="ghost" size="icon" className="text-red-600" onClick={() => deleteLicense(license)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Generate Licenses Tab */}
        <TabsContent value="generate" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-green-600" />
                Neue Lizenzen Generieren
              </CardTitle>
              <CardDescription>
                Erstellen Sie neue Lizenzschlüssel für Ihre Kunden
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="count">Anzahl</Label>
                  <Input
                    id="count"
                    type="number"
                    min="1"
                    max="100"
                    value={licenseForm.count}
                    onChange={(e) => setLicenseForm({ ...licenseForm, count: parseInt(e.target.value) || 1 })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="user_limit">Benutzer-Limit pro Lizenz</Label>
                  <Input
                    id="user_limit"
                    type="number"
                    min="1"
                    value={licenseForm.user_limit}
                    onChange={(e) => setLicenseForm({ ...licenseForm, user_limit: parseInt(e.target.value) || 10 })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notizen</Label>
                  <Input
                    id="notes"
                    placeholder="z.B. Kunde ABC GmbH"
                    value={licenseForm.notes}
                    onChange={(e) => setLicenseForm({ ...licenseForm, notes: e.target.value })}
                  />
                </div>
              </div>

              <div className="pt-4 border-t flex justify-between items-center">
                <p className="text-sm text-slate-600">
                  Erstellt: <strong>{licenseForm.count}</strong> Lizenzen mit je <strong>{licenseForm.user_limit}</strong> Benutzer
                </p>
                <Button onClick={generateLicenses} disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Key className="w-4 h-4 mr-2" />}
                  Lizenzen Generieren
                </Button>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <div className="text-sm text-amber-800">
                  <p className="font-semibold">Wichtig:</p>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>Sie benötigen den MASTER_ADMIN_KEY aus der .env Datei</li>
                    <li>Generierte Lizenzen können nur einmal verwendet werden</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Organizations Tab */}
        <TabsContent value="organizations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-purple-600" />
                Organisationen ({organizations.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {organizations.map((org) => (
                  <Card key={org.id} className={org.status === 'suspended' ? 'border-red-200 bg-red-50' : ''}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-lg">{org.name}</h3>
                            <Badge variant={org.status === 'active' ? 'default' : 'destructive'}>
                              {org.status === 'active' ? 'Aktiv' : org.status}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-slate-500">Benutzer:</span>
                              <p className="font-medium">{org.user_count} / {org.user_limit}</p>
                            </div>
                            <div>
                              <span className="text-slate-500">Cases:</span>
                              <p className="font-medium">{org.case_count}</p>
                            </div>
                            <div>
                              <span className="text-slate-500">Lizenz:</span>
                              <p className="font-mono text-xs">{org.license_key}</p>
                            </div>
                            <div>
                              <span className="text-slate-500">Erstellt:</span>
                              <p className="font-medium">{formatDate(org.created_at)}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit License Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lizenz bearbeiten</DialogTitle>
            <DialogDescription>
              {editingLicense?.key}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Benutzer-Limit</Label>
              <Input
                type="number"
                min="1"
                value={editForm.user_limit}
                onChange={(e) => setEditForm({ ...editForm, user_limit: parseInt(e.target.value) || 1 })}
              />
              <p className="text-xs text-slate-500">-1 für unbegrenzt</p>
            </div>
            <div className="space-y-2">
              <Label>Ablaufdatum</Label>
              <Input
                type="date"
                value={editForm.expires_at}
                onChange={(e) => setEditForm({ ...editForm, expires_at: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Notizen</Label>
              <Input
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                placeholder="Interne Notizen"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Abbrechen</Button>
            <Button onClick={saveEditedLicense}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Users Dialog */}
      <Dialog open={showAddUsersDialog} onOpenChange={setShowAddUsersDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Benutzer hinzufügen</DialogTitle>
            <DialogDescription>
              Erhöhen Sie das Benutzer-Limit für {addUsersLicense?.organization_name || addUsersLicense?.key}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-slate-50 p-4 rounded-lg">
              <p className="text-sm">Aktuelles Limit: <strong>{addUsersLicense?.user_limit}</strong> Benutzer</p>
              <p className="text-sm">Aktuelle Nutzung: <strong>{addUsersLicense?.current_users || 0}</strong> Benutzer</p>
            </div>
            <div className="space-y-2">
              <Label>Zusätzliche Benutzer</Label>
              <Input
                type="number"
                min="1"
                value={additionalUsers}
                onChange={(e) => setAdditionalUsers(parseInt(e.target.value) || 1)}
              />
            </div>
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm">Neues Limit: <strong>{(addUsersLicense?.user_limit || 0) + additionalUsers}</strong> Benutzer</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddUsersDialog(false)}>Abbrechen</Button>
            <Button onClick={addUsersToLicense}>
              <UserPlus className="w-4 h-4 mr-2" />
              Benutzer hinzufügen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke License Dialog */}
      <Dialog open={showRevokeDialog} onOpenChange={setShowRevokeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <Ban className="w-5 h-5" />
              Lizenz widerrufen
            </DialogTitle>
            <DialogDescription>
              Diese Aktion sperrt die Organisation {revokeLicense?.organization_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
              <p className="text-sm text-red-800 font-medium">Achtung!</p>
              <ul className="text-sm text-red-700 mt-2 space-y-1">
                <li>• Die Organisation wird sofort gesperrt</li>
                <li>• Alle Benutzer können sich nicht mehr anmelden</li>
                <li>• Die Lizenz kann später reaktiviert werden</li>
              </ul>
            </div>
            <div className="space-y-2">
              <Label>Grund (optional)</Label>
              <Input
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                placeholder="z.B. Zahlungsverzug, Vertragskündigung"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRevokeDialog(false)}>Abbrechen</Button>
            <Button variant="destructive" onClick={handleRevokeLicense}>
              <Ban className="w-4 h-4 mr-2" />
              Lizenz widerrufen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
